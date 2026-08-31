-- 0001_goray_init.sql
-- Goray Private PostgreSQL Schema v1.0.0

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. 迁移记录表
CREATE TABLE IF NOT EXISTS goray_schema_migrations (
    version             BIGINT PRIMARY KEY,
    name                VARCHAR(191) NOT NULL,
    checksum_sha256     CHAR(64) NOT NULL,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_ms        INTEGER NOT NULL CHECK (execution_ms >= 0)
);

-- 2. 权益表
CREATE TABLE IF NOT EXISTS goray_entitlements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apay_user_id        BIGINT NOT NULL,
    source_type         VARCHAR(16) NOT NULL CHECK (source_type IN ('subscription','order','redeem','admin','trial')),
    source_id           VARCHAR(128) NOT NULL,
    plan_code           VARCHAR(64) NOT NULL,
    plan_level          INTEGER NOT NULL DEFAULT 0,
    device_limit        INTEGER NOT NULL CHECK (device_limit > 0),
    traffic_limit_bytes BIGINT NOT NULL DEFAULT 0 CHECK (traffic_limit_bytes >= 0),
    used_traffic_bytes  BIGINT NOT NULL DEFAULT 0 CHECK (used_traffic_bytes >= 0),
    starts_at           TIMESTAMPTZ NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    status              VARCHAR(16) NOT NULL CHECK (status IN ('pending','active','suspended','expired','revoked')),
    source_version      VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_goray_entitlements_user_status
    ON goray_entitlements(apay_user_id, status, expires_at DESC);

-- 3. 设备授权记录表
CREATE TABLE IF NOT EXISTS goray_device_authorizations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code_hash            CHAR(64) NOT NULL UNIQUE,
    user_code_hash              CHAR(64) NOT NULL UNIQUE,
    device_id                   UUID NOT NULL,
    device_name                 VARCHAR(128) NOT NULL,
    platform                    VARCHAR(16) NOT NULL CHECK (platform IN ('android','ios','windows','macos')),
    app_version                 VARCHAR(32) NOT NULL,
    encryption_public_key_spki  BYTEA NOT NULL,
    encryption_key_thumbprint   CHAR(64) NOT NULL,
    proof_public_jwk            JSONB NOT NULL,
    proof_key_jkt               CHAR(43) NOT NULL,
    apay_user_id                BIGINT,
    status                      VARCHAR(16) NOT NULL CHECK (status IN ('pending','approved','denied','consumed')),
    expires_at                  TIMESTAMPTZ NOT NULL,
    approved_at                 TIMESTAMPTZ,
    consumed_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goray_device_authorizations_expiry
    ON goray_device_authorizations(status, expires_at);

-- 4. 设备表
CREATE TABLE IF NOT EXISTS goray_devices (
    id                      UUID PRIMARY KEY,
    apay_user_id            BIGINT NOT NULL,
    name                    VARCHAR(128) NOT NULL,
    platform                VARCHAR(16) NOT NULL CHECK (platform IN ('android','ios','windows','macos')),
    app_version             VARCHAR(32) NOT NULL,
    encryption_public_key_spki BYTEA NOT NULL,
    encryption_key_thumbprint CHAR(64) NOT NULL,
    proof_public_jwk        JSONB NOT NULL,
    proof_key_jkt           CHAR(43) NOT NULL,
    data_key_id             UUID,
    encrypted_data_key      BYTEA,
    encrypted_data_key_nonce BYTEA CHECK (encrypted_data_key_nonce IS NULL OR octet_length(encrypted_data_key_nonce) = 12),
    key_version             INTEGER NOT NULL DEFAULT 1,
    status                  VARCHAR(16) NOT NULL CHECK (status IN ('active','revoked','blocked')),
    last_seen_at            TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (status = 'active' AND data_key_id IS NOT NULL AND encrypted_data_key IS NOT NULL AND encrypted_data_key_nonce IS NOT NULL)
      OR
      (status IN ('revoked','blocked') AND data_key_id IS NULL AND encrypted_data_key IS NULL AND encrypted_data_key_nonce IS NULL)
    ),
    UNIQUE (encryption_key_thumbprint),
    UNIQUE (proof_key_jkt)
);

CREATE INDEX IF NOT EXISTS idx_goray_devices_user_status
    ON goray_devices(apay_user_id, status);

-- 5. Refresh Token 家族表
CREATE TABLE IF NOT EXISTS goray_refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES goray_devices(id) ON DELETE CASCADE,
    family_id           UUID NOT NULL,
    token_hash          CHAR(64) NOT NULL UNIQUE,
    parent_token_id     UUID REFERENCES goray_refresh_tokens(id),
    expires_at          TIMESTAMPTZ NOT NULL,
    used_at             TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goray_refresh_tokens_device_family
    ON goray_refresh_tokens(device_id, family_id, created_at DESC);

-- 6. 节点表
CREATE TABLE IF NOT EXISTS goray_nodes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name        VARCHAR(128) NOT NULL,
    country_code        CHAR(2) NOT NULL,
    region              VARCHAR(64),
    protocol            VARCHAR(16) NOT NULL DEFAULT 'vmess' CHECK (protocol IN ('vmess', 'hysteria2')),
    encrypted_config    BYTEA NOT NULL,
    config_nonce        BYTEA NOT NULL CHECK (octet_length(config_nonce) = 12),
    config_key_version  INTEGER NOT NULL,
    weight              INTEGER NOT NULL DEFAULT 100,
    display_order       INTEGER NOT NULL DEFAULT 0,
    status              VARCHAR(16) NOT NULL CHECK (status IN ('online','offline','maintenance')),
    health_status       VARCHAR(16) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','down','unknown')),
    last_checked_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goray_nodes_available
    ON goray_nodes(status, display_order, weight DESC);

-- 7. 节点健康样本表
CREATE TABLE IF NOT EXISTS goray_node_health_samples (
    id                  BIGSERIAL PRIMARY KEY,
    node_id             UUID NOT NULL REFERENCES goray_nodes(id) ON DELETE CASCADE,
    observer_id         VARCHAR(64) NOT NULL,
    success             BOOLEAN NOT NULL,
    handshake_ms        INTEGER CHECK (handshake_ms IS NULL OR handshake_ms >= 0),
    result_code         VARCHAR(32) NOT NULL CHECK (result_code IN ('ok','timeout','tcp_failed','tls_failed','ws_failed','vmess_failed','probe_unavailable')),
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goray_node_health_samples_window
    ON goray_node_health_samples(node_id, checked_at DESC);

-- 8. 流量上报明细表
CREATE TABLE IF NOT EXISTS goray_traffic_reports (
    report_id           UUID PRIMARY KEY,
    device_id           UUID NOT NULL REFERENCES goray_devices(id),
    entitlement_id      UUID NOT NULL REFERENCES goray_entitlements(id),
    node_id             UUID REFERENCES goray_nodes(id),
    session_id          UUID NOT NULL,
    sequence            BIGINT NOT NULL CHECK (sequence >= 0),
    upload_delta_bytes  BIGINT NOT NULL CHECK (upload_delta_bytes >= 0),
    download_delta_bytes BIGINT NOT NULL CHECK (download_delta_bytes >= 0),
    duration_delta_seconds INTEGER NOT NULL CHECK (duration_delta_seconds >= 0),
    connected           BOOLEAN NOT NULL,
    payload_hash        CHAR(64) NOT NULL,
    used_traffic_bytes_after BIGINT NOT NULL CHECK (used_traffic_bytes_after >= 0),
    need_disconnect_after BOOLEAN NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, session_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_goray_traffic_reports_entitlement_time
    ON goray_traffic_reports(entitlement_id, received_at DESC);

-- 9. 流量日汇总表
CREATE TABLE IF NOT EXISTS goray_traffic_daily_totals (
    day                     DATE NOT NULL,
    platform                VARCHAR(16) NOT NULL CHECK (platform IN ('android','ios','windows','macos')),
    upload_bytes            BIGINT NOT NULL CHECK (upload_bytes >= 0),
    download_bytes          BIGINT NOT NULL CHECK (download_bytes >= 0),
    duration_seconds        BIGINT NOT NULL CHECK (duration_seconds >= 0),
    report_count            BIGINT NOT NULL CHECK (report_count >= 0),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(day, platform)
);

-- 10. 兑换码批次与兑换码表
CREATE TABLE IF NOT EXISTS goray_redeem_batches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_count              INTEGER NOT NULL CHECK (code_count > 0),
    plan_code               VARCHAR(64) NOT NULL,
    export_ciphertext       BYTEA,
    export_nonce            BYTEA CHECK (export_nonce IS NULL OR octet_length(export_nonce) = 12),
    export_key_version      INTEGER,
    export_expires_at       TIMESTAMPTZ,
    exported_at             TIMESTAMPTZ,
    created_by              VARCHAR(128) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (export_ciphertext IS NULL AND export_nonce IS NULL AND export_key_version IS NULL)
      OR
      (export_ciphertext IS NOT NULL AND export_nonce IS NOT NULL AND export_key_version IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS goray_redeem_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash           CHAR(64) NOT NULL UNIQUE,
    code_prefix         VARCHAR(12) NOT NULL,
    plan_code           VARCHAR(64) NOT NULL,
    plan_level          INTEGER NOT NULL,
    duration_days       INTEGER NOT NULL CHECK (duration_days > 0),
    device_limit        INTEGER NOT NULL CHECK (device_limit > 0),
    traffic_limit_bytes BIGINT NOT NULL DEFAULT 0 CHECK (traffic_limit_bytes >= 0),
    stackable           BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(16) NOT NULL CHECK (status IN ('available','used','revoked','expired')),
    batch_id            UUID NOT NULL REFERENCES goray_redeem_batches(id),
    expires_at          TIMESTAMPTZ,
    used_by             BIGINT,
    used_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. APay 事件记录与对账状态表
CREATE TABLE IF NOT EXISTS goray_apay_events (
    event_id            VARCHAR(191) PRIMARY KEY,
    event_type          VARCHAR(64) NOT NULL,
    resource_id         VARCHAR(128) NOT NULL,
    payload_hash        CHAR(64) NOT NULL,
    status              VARCHAR(16) NOT NULL CHECK (status IN ('processing','applied','ignored','failed')),
    attempts            INTEGER NOT NULL DEFAULT 0,
    last_error          TEXT,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS goray_reconcile_state (
    stream              VARCHAR(64) PRIMARY KEY,
    cursor              VARCHAR(191) NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. 幂等控制记录表
CREATE TABLE IF NOT EXISTS goray_idempotency_records (
    scope               VARCHAR(64) NOT NULL,
    idempotency_key     VARCHAR(128) NOT NULL,
    request_hash        CHAR(64) NOT NULL,
    state               VARCHAR(16) NOT NULL CHECK (state IN ('processing','completed','failed')),
    response_status     INTEGER,
    response_body       JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(scope, idempotency_key)
);

-- 13. 用户删除墓碑与删除任务表
CREATE TABLE IF NOT EXISTS goray_deletion_tombstones (
    subject_hash        CHAR(64) PRIMARY KEY,
    source_event_id     VARCHAR(191) NOT NULL UNIQUE,
    requested_at        TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,
    backup_expires_at   TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goray_deletion_jobs (
    subject_hash            CHAR(64) PRIMARY KEY REFERENCES goray_deletion_tombstones(subject_hash) ON DELETE CASCADE,
    encrypted_apay_user_id  BYTEA,
    subject_nonce           BYTEA CHECK (subject_nonce IS NULL OR octet_length(subject_nonce) = 12),
    key_version             INTEGER,
    status                  VARCHAR(16) NOT NULL CHECK (status IN ('pending','running','failed','completed')),
    attempts                INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by               VARCHAR(128),
    locked_until            TIMESTAMPTZ,
    last_error_code         VARCHAR(64),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (status IN ('pending','running','failed') AND encrypted_apay_user_id IS NOT NULL AND subject_nonce IS NOT NULL AND key_version IS NOT NULL)
      OR
      (status = 'completed' AND encrypted_apay_user_id IS NULL AND subject_nonce IS NULL AND key_version IS NULL)
    )
);

-- 14. 客户端发布与资源清单表
CREATE TABLE IF NOT EXISTS goray_releases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        VARCHAR(16) NOT NULL CHECK (platform IN ('android','ios','windows','macos')),
    version         VARCHAR(32) NOT NULL,
    build_number    BIGINT NOT NULL,
    minimum_version VARCHAR(32),
    force_update    BOOLEAN NOT NULL DEFAULT FALSE,
    download_url    TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    sha256          CHAR(64) NOT NULL,
    signing_key_id  VARCHAR(64) NOT NULL,
    manifest_payload BYTEA NOT NULL,
    signature       BYTEA NOT NULL,
    changelog       JSONB NOT NULL DEFAULT '{}'::jsonb,
    released_at     TIMESTAMPTZ NOT NULL,
    status          VARCHAR(16) NOT NULL CHECK (status IN ('draft','published','revoked')),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(platform, version, build_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_goray_releases_current_platform
    ON goray_releases(platform) WHERE status='published';

CREATE TABLE IF NOT EXISTS goray_resource_manifests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_version VARCHAR(32) NOT NULL UNIQUE,
    sing_box_version VARCHAR(32) NOT NULL,
    resource_count  INTEGER NOT NULL CHECK (resource_count > 0),
    signing_key_id  VARCHAR(64) NOT NULL,
    manifest_payload BYTEA NOT NULL,
    signature       BYTEA NOT NULL,
    status          VARCHAR(16) NOT NULL CHECK (status IN ('draft','published','revoked')),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (octet_length(manifest_payload) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_goray_resource_manifests_current
    ON goray_resource_manifests((TRUE)) WHERE status='published';

-- 15. 审计日志表
CREATE TABLE IF NOT EXISTS goray_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_type      VARCHAR(16) NOT NULL,
    actor_id        VARCHAR(128),
    action          VARCHAR(64) NOT NULL,
    resource_type   VARCHAR(64) NOT NULL,
    resource_id     VARCHAR(128),
    summary         TEXT,
    request_id      UUID,
    ip_hash         CHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
