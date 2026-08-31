import { goraySql } from '../db/pg'

export interface Entitlement {
  id: string
  apay_user_id: number
  source_type: 'subscription' | 'order' | 'redeem' | 'admin' | 'trial'
  source_id: string
  plan_code: string
  plan_level: number
  device_limit: number
  traffic_limit_bytes: number
  used_traffic_bytes: number
  starts_at: string
  expires_at: string
  status: 'pending' | 'active' | 'suspended' | 'expired' | 'revoked'
  source_version?: string
}

export interface EffectiveEntitlementResult {
  entitlement: Entitlement | null
  isUsable: boolean
  needDisconnect: boolean
  activeDevicesCount: number
  deviceLimit: number
  remainingTrafficBytes: number | null // null 表示无限
}

/**
 * 计算用户的当前有效权益 (Effective Entitlement)
 */
export const getEffectiveEntitlement = async (apayUserId: number): Promise<EffectiveEntitlementResult> => {
  // 1. 查询该用户所有未过期且 status = 'active' 的权益候选
  const candidates = await goraySql<Entitlement[]>`
    SELECT 
      id, apay_user_id, source_type, source_id, plan_code, plan_level,
      device_limit, traffic_limit_bytes, used_traffic_bytes,
      starts_at, expires_at, status, source_version
    FROM goray_entitlements
    WHERE apay_user_id = ${apayUserId}
      AND status = 'active'
      AND starts_at <= NOW()
      AND expires_at > NOW()
    ORDER BY plan_level DESC, expires_at ASC, starts_at ASC, id ASC
  `

  // 2. 统计当前活跃设备数量
  const [deviceRow] = await goraySql<{ count: number }[]>`
    SELECT count(*)::int as count FROM goray_devices
    WHERE apay_user_id = ${apayUserId} AND status = 'active'
  `
  const activeDevicesCount = deviceRow?.count || 0

  if (candidates.length === 0) {
    return {
      entitlement: null,
      isUsable: false,
      needDisconnect: true,
      activeDevicesCount,
      deviceLimit: 0,
      remainingTrafficBytes: 0,
    }
  }

  // 3. 筛选出流量未耗尽的 usable 候选
  const usable = candidates.filter(
    (e) => Number(e.traffic_limit_bytes) === 0 || Number(e.used_traffic_bytes) < Number(e.traffic_limit_bytes)
  )

  if (usable.length > 0) {
    const best = usable[0]
    const limitBytes = Number(best.traffic_limit_bytes)
    const usedBytes = Number(best.used_traffic_bytes)
    const remaining = limitBytes === 0 ? null : Math.max(0, limitBytes - usedBytes)

    return {
      entitlement: best,
      isUsable: true,
      needDisconnect: false,
      activeDevicesCount,
      deviceLimit: best.device_limit,
      remainingTrafficBytes: remaining,
    }
  }

  // 4. 有有效套餐但流量已用尽
  const topActive = candidates[0]
  return {
    entitlement: topActive,
    isUsable: false,
    needDisconnect: true,
    activeDevicesCount,
    deviceLimit: topActive.device_limit,
    remainingTrafficBytes: 0,
  }
}

/**
 * 校验并限制用户设备数量（超额时将多余设备设为 blocked 并销毁 DATA_KEY）
 */
export const enforceDeviceLimit = async (apayUserId: number, maxDevices: number): Promise<void> => {
  if (maxDevices <= 0) return

  await goraySql.begin(async (tx) => {
    // 锁定该用户的设备列表
    const devices = await tx<{ id: string }[]>`
      SELECT id FROM goray_devices
      WHERE apay_user_id = ${apayUserId} AND status = 'active'
      ORDER BY last_seen_at DESC NULLS LAST, created_at ASC, id ASC
      FOR UPDATE
    `

    if (devices.length > maxDevices) {
      const allowedIds = devices.slice(0, maxDevices).map((d) => d.id)
      const blockedIds = devices.slice(maxDevices).map((d) => d.id)

      if (blockedIds.length > 0) {
        // 将超出上限的设备置为 blocked，并销毁 DATA_KEY
        await tx`
          UPDATE goray_devices
          SET status = 'blocked',
              data_key_id = NULL,
              encrypted_data_key = NULL,
              encrypted_data_key_nonce = NULL,
              updated_at = NOW()
          WHERE id = ANY(${blockedIds})
        `

        // 撤销这些设备的 Refresh Tokens
        await tx`
          UPDATE goray_refresh_tokens
          SET revoked_at = NOW()
          WHERE device_id = ANY(${blockedIds}) AND revoked_at IS NULL
        `
      }
    }
  })
}
