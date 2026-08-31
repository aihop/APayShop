# AGENTS.md - APay goray 主题工程入口

> 本文件是 APay 宿主工程内 `app/themes/goray` 独立主题的唯一主题级入口，规定边界、安全协议与开发纪律。

## 1. 职责与边界

本主题作为 APay Node/Nitro 进程中的控制面运行，负责：

- Goray 官网、定价、下载、设备激活、用户中心与帮助文档页面；
- `/api/goray/v1/**` 客户端控制面 API；
- `/api/admin/goray/**` 主题管理 API；
- 主题私有 PostgreSQL 数据库（`GORAY_DATABASE_URL`）与 Redis 状态；
- 节点密钥管理（服务端 KEK 加密，设备 DATA_KEY 动态加解密）；
- APay 订单、订阅 Webhook 事件消费与权益幂等物化。

本主题不得：
- 把 Goray 私有表（节点、设备、Token、流量）写入 APay Core 的 Drizzle Schema；
- 与 APay 核心数据库执行跨库 JOIN 查询；
- 在消费者前台展示 VMess、TUN、CIDR、UUID 等技术术语；
- 修改 APay Core 的全局变量或共享组件默认色。

## 2. 安全与协议

- **Master Key (KEK)**：仅在服务端内存中持有，用于加密节点 Secret；
- **设备授权**：基于 256-bit 哈希设备码与 8 位大写用户码，通过 APay 网页登录确认；
- **DPoP Token**：Access Token（15 分钟）由客户端 P-256 私钥 DPoP 签名约束，Refresh Token（30 天）轮换且仅存哈希；
- **DATA_KEY 密文信封**：节点下发使用每设备 P-256 ECDH 协商的 DATA_KEY 执行 AES-256-GCM 加密，严禁明文传输。

## 3. 文档地图

详细协议规范参见客户端仓 `docs/`：
- `docs/apay-integration.md` - APay 主题与商业闭环
- `docs/theme-server-implementation.md` - 服务端目录与运行时
- `docs/database-schema.md` - 私有数据库 PostgreSQL 表结构
- `docs/api-spec.md` - 完整 API 合约
- `docs/crypto-protocol.md` - 密码学信封与 DPoP 规范
