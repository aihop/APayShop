import { createHash } from 'node:crypto'
import { goraySql } from '../db/pg'
import { decryptWithKek } from '../crypto/kek'
import { decryptApiPayload } from '../crypto/ecdh'
import { Errors } from '../shared/errors'
import { getEffectiveEntitlement } from '../entitlements/service'

export interface ClientTrafficReport {
  report_id: string
  session_id: string
  sequence: number
  node_id?: string
  upload_delta_bytes: number
  download_delta_bytes: number
  duration_delta_seconds: number
  connected: boolean
  occurred_at: string
}

export const processTrafficReport = async (
  deviceId: string,
  apayUserId: number,
  requestId: string,
  clientTime: number,
  encryptedEnvelope: { key_id: string; nonce: string; ciphertext: string }
) => {
  // 1. 获取设备及其 DATA_KEY
  const [device] = await goraySql<{
    id: string
    status: string
    platform: string
    data_key_id: string | null
    encrypted_data_key: Buffer | null
    encrypted_data_key_nonce: Buffer | null
  }[]>`
    SELECT id, status, platform, data_key_id, encrypted_data_key, encrypted_data_key_nonce
    FROM goray_devices
    WHERE id = ${deviceId} AND apay_user_id = ${apayUserId}
  `

  if (!device || device.status !== 'active' || !device.data_key_id || !device.encrypted_data_key || !device.encrypted_data_key_nonce) {
    throw Errors.deviceNotFound()
  }

  const dataKey = decryptWithKek(
    device.encrypted_data_key,
    device.encrypted_data_key_nonce,
    `goray-device-data-key\n${device.id}\n${device.data_key_id}`,
    1
  )

  // 2. 解密请求体
  let report: ClientTrafficReport
  try {
    const jsonStr = decryptApiPayload(
      dataKey,
      encryptedEnvelope,
      'POST',
      '/api/goray/v1/traffic',
      requestId,
      clientTime,
      deviceId
    )
    report = JSON.parse(jsonStr)
  } catch (err) {
    throw Errors.badRequest('Failed to decrypt traffic report envelope')
  }

  const payloadHash = createHash('sha256').update(JSON.stringify(report), 'utf8').digest('hex')

  return await goraySql.begin(async (tx) => {
    // 3. 幂等与重放检查
    const [existingReport] = await tx<{
      report_id: string
      payload_hash: string
      used_traffic_bytes_after: number
      need_disconnect_after: boolean
    }[]>`
      SELECT report_id, payload_hash, used_traffic_bytes_after, need_disconnect_after
      FROM goray_traffic_reports
      WHERE report_id = ${report.report_id}
         OR (device_id = ${deviceId} AND session_id = ${report.session_id} AND sequence = ${report.sequence})
      FOR UPDATE
    `

    if (existingReport) {
      if (existingReport.payload_hash === payloadHash) {
        // 重复上报，返回历史处理结果
        return {
          used_traffic_bytes: existingReport.used_traffic_bytes_after,
          need_disconnect: existingReport.need_disconnect_after,
        }
      }
      throw Errors.conflict('Idempotency conflict for traffic report')
    }

    // 4. 获取用户当前有效权益
    const entitlementResult = await getEffectiveEntitlement(apayUserId)
    if (!entitlementResult.entitlement) {
      throw Errors.entitlementRequired('No active entitlement found')
    }

    const entitlement = entitlementResult.entitlement
    const totalDelta = Number(report.upload_delta_bytes) + Number(report.download_delta_bytes)
    const newUsedBytes = Number(entitlement.used_traffic_bytes) + totalDelta

    let needDisconnect = false
    if (Number(entitlement.traffic_limit_bytes) > 0 && newUsedBytes >= Number(entitlement.traffic_limit_bytes)) {
      needDisconnect = true
    }

    // 5. 累加流量到有效权益
    await tx`
      UPDATE goray_entitlements
      SET used_traffic_bytes = ${newUsedBytes},
          updated_at = NOW()
      WHERE id = ${entitlement.id}
    `

    // 6. 插入流量记录
    await tx`
      INSERT INTO goray_traffic_reports (
        report_id, device_id, entitlement_id, node_id, session_id, sequence,
        upload_delta_bytes, download_delta_bytes, duration_delta_seconds, connected,
        payload_hash, used_traffic_bytes_after, need_disconnect_after, occurred_at
      ) VALUES (
        ${report.report_id}, ${deviceId}, ${entitlement.id}, ${report.node_id || null},
        ${report.session_id}, ${report.sequence},
        ${report.upload_delta_bytes}, ${report.download_delta_bytes}, ${report.duration_delta_seconds},
        ${report.connected}, ${payloadHash}, ${newUsedBytes}, ${needDisconnect},
        ${new Date(report.occurred_at || Date.now())}
      )
    `

    // 7. 更新设备最近活跃时间
    await tx`
      UPDATE goray_devices
      SET last_seen_at = NOW()
      WHERE id = ${deviceId}
    `

    return {
      used_traffic_bytes: newUsedBytes,
      need_disconnect: needDisconnect,
    }
  })
}
