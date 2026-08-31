import { createHash } from 'node:crypto'
import { goraySql } from '../db/pg'
import { hashDeletionSubject } from '../crypto/hmac'
import { enforceDeviceLimit } from './service'

export interface ApayWebhookEvent {
  event: string
  timestamp: number
  data: {
    id: string | number
    user_id: string | number
    order_id?: string | number
    subscription_id?: string | number
    plan_code?: string
    plan_level?: number
    device_limit?: number
    traffic_bytes?: number
    duration_days?: number
    starts_at?: string
    expires_at?: string
    version?: string
    refund_status?: string
    [key: string]: any
  }
}

export const processApayWebhookEvent = async (event: ApayWebhookEvent, rawBody: string) => {
  const payloadHash = createHash('sha256').update(rawBody, 'utf8').digest('hex')
  const eventId = `${event.event}_${event.data.id}_${event.data.version || event.timestamp}`

  return await goraySql.begin(async (tx) => {
    // 1. 幂等记录检查
    const [existingEvent] = await tx<{
      event_id: string
      status: string
      payload_hash: string
    }[]>`
      SELECT event_id, status, payload_hash FROM goray_apay_events
      WHERE event_id = ${eventId}
      FOR UPDATE
    `

    if (existingEvent) {
      if (existingEvent.status === 'applied') {
        return { status: 'already_applied' }
      }
      if (existingEvent.payload_hash !== payloadHash) {
        throw new Error('Payload hash mismatch for event')
      }
    } else {
      await tx`
        INSERT INTO goray_apay_events (
          event_id, event_type, resource_id, payload_hash, status
        ) VALUES (
          ${eventId}, ${event.event}, ${String(event.data.id)}, ${payloadHash}, 'processing'
        )
      `
    }

    const userId = Number(event.data.user_id)

    // 2. 根据事件类型分发业务逻辑
    switch (event.event) {
      case 'order.paid': {
        const planCode = event.data.plan_code || 'goray_monthly'
        const planLevel = Number(event.data.plan_level || 10)
        const deviceLimit = Number(event.data.device_limit || 3)
        const trafficLimit = Number(event.data.traffic_bytes || 0)
        const durationDays = Number(event.data.duration_days || 30)

        const startsAt = event.data.starts_at ? new Date(event.data.starts_at) : new Date()
        const expiresAt = event.data.expires_at
          ? new Date(event.data.expires_at)
          : new Date(startsAt.getTime() + durationDays * 86400 * 1000)

        await tx`
          INSERT INTO goray_entitlements (
            apay_user_id, source_type, source_id, plan_code, plan_level,
            device_limit, traffic_limit_bytes, used_traffic_bytes,
            starts_at, expires_at, status, source_version
          ) VALUES (
            ${userId}, 'order', ${String(event.data.id)}, ${planCode}, ${planLevel},
            ${deviceLimit}, ${trafficLimit}, 0,
            ${startsAt}, ${expiresAt}, 'active', ${String(event.data.version || '1')}
          )
          ON CONFLICT (source_type, source_id) DO UPDATE SET
            plan_code = EXCLUDED.plan_code,
            plan_level = EXCLUDED.plan_level,
            device_limit = EXCLUDED.device_limit,
            traffic_limit_bytes = EXCLUDED.traffic_limit_bytes,
            starts_at = EXCLUDED.starts_at,
            expires_at = EXCLUDED.expires_at,
            status = 'active',
            source_version = EXCLUDED.source_version,
            updated_at = NOW()
        `
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const status = event.event === 'subscription.expired' ? 'expired' : 'active'
        await tx`
          UPDATE goray_entitlements
          SET status = ${status},
              updated_at = NOW()
          WHERE source_type = 'subscription' AND source_id = ${String(event.data.id)}
        `
        break
      }

      case 'order.refunded': {
        await tx`
          UPDATE goray_entitlements
          SET status = 'revoked',
              updated_at = NOW()
          WHERE source_type = 'order' AND source_id = ${String(event.data.id)}
        `
        // 退款后裁剪超出配额的设备
        await enforceDeviceLimit(userId, 0)
        break
      }

      case 'user.deleted': {
        const subjectHash = hashDeletionSubject(userId)
        // 写入不可逆墓碑
        await tx`
          INSERT INTO goray_deletion_tombstones (
            subject_hash, source_event_id, requested_at, backup_expires_at
          ) VALUES (
            ${subjectHash}, ${eventId}, NOW(), NOW() + interval '400 days'
          )
          ON CONFLICT (subject_hash) DO NOTHING
        `

        // 撤销该用户全部设备和 Token
        const devices = await tx<{ id: string }[]>`
          SELECT id FROM goray_devices WHERE apay_user_id = ${userId}
        `
        const deviceIds = devices.map((d) => d.id)

        if (deviceIds.length > 0) {
          await tx`
            UPDATE goray_devices
            SET status = 'revoked',
                data_key_id = NULL,
                encrypted_data_key = NULL,
                encrypted_data_key_nonce = NULL,
                revoked_at = NOW(),
                updated_at = NOW()
            WHERE id = ANY(${deviceIds})
          `

          await tx`
            UPDATE goray_refresh_tokens
            SET revoked_at = NOW()
            WHERE device_id = ANY(${deviceIds})
          `
        }

        // 撤销用户全部权益
        await tx`
          UPDATE goray_entitlements
          SET status = 'revoked',
              updated_at = NOW()
          WHERE apay_user_id = ${userId}
        `
        break
      }
    }

    // 3. 标记事件为 applied
    await tx`
      UPDATE goray_apay_events
      SET status = 'applied',
          processed_at = NOW()
      WHERE event_id = ${eventId}
    `

    return { status: 'applied' }
  })
}
