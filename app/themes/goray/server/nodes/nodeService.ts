import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { decryptWithKek, encryptWithKek } from '../crypto/kek'
import { encryptApiPayload } from '../crypto/ecdh'
import { goraySql } from '../db/pg'
import { Errors } from '../shared/errors'

export interface NodeSecretConfig {
  server_addr: string
  server_port: number
  protocol: 'vmess' | 'hysteria2'
  uuid?: string
  password?: string
  security?: string
  ws_path?: string
  ws_host?: string
  tls_enabled?: boolean
  sni?: string
  utls_fingerprint?: string
  obfs?: string
  obfs_password?: string
}

export interface NodeRecord {
  id: string
  display_name: string
  country_code: string
  region?: string
  protocol: 'vmess' | 'hysteria2'
  encrypted_config: Buffer
  config_nonce: Buffer
  config_key_version: number
  weight: number
  display_order: number
  status: 'online' | 'offline' | 'maintenance'
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown'
}

/**
 * 后台创建/更新节点
 */
export const saveNode = async (
  nodeId: string | null,
  displayName: string,
  countryCode: string,
  region: string | undefined,
  protocol: 'vmess' | 'hysteria2',
  config: NodeSecretConfig,
  weight = 100,
  displayOrder = 0,
  status: 'online' | 'offline' | 'maintenance' = 'online'
): Promise<string> => {
  const id = nodeId || randomUUID()
  const configJson = JSON.stringify(config)
  const kekEnc = encryptWithKek(configJson, `goray-node-config\n${id}\n1`, 1)

  if (nodeId) {
    await goraySql`
      UPDATE goray_nodes
      SET display_name = ${displayName},
          country_code = ${countryCode.toUpperCase()},
          region = ${region || null},
          protocol = ${protocol},
          encrypted_config = ${kekEnc.ciphertext},
          config_nonce = ${kekEnc.nonce},
          config_key_version = 1,
          weight = ${weight},
          display_order = ${displayOrder},
          status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
    `
  } else {
    await goraySql`
      INSERT INTO goray_nodes (
        id, display_name, country_code, region, protocol,
        encrypted_config, config_nonce, config_key_version,
        weight, display_order, status, health_status
      ) VALUES (
        ${id}, ${displayName}, ${countryCode.toUpperCase()}, ${region || null}, ${protocol},
        ${kekEnc.ciphertext}, ${kekEnc.nonce}, 1,
        ${weight}, ${displayOrder}, ${status}, 'unknown'
      )
    `
  }

  return id
}

/**
 * 为指定设备生成经过 DATA_KEY 加密的节点列表信封
 */
export const getEncryptedNodesForDevice = async (
  deviceId: string,
  apayUserId: number,
  requestId: string
) => {
  // 1. 获取设备及其 DATA_KEY
  const [device] = await goraySql<{
    id: string
    status: string
    data_key_id: string | null
    encrypted_data_key: Buffer | null
    encrypted_data_key_nonce: Buffer | null
  }[]>`
    SELECT id, status, data_key_id, encrypted_data_key, encrypted_data_key_nonce
    FROM goray_devices
    WHERE id = ${deviceId} AND apay_user_id = ${apayUserId}
  `

  if (!device || device.status !== 'active' || !device.data_key_id || !device.encrypted_data_key || !device.encrypted_data_key_nonce) {
    throw Errors.deviceNotFound('Device not found or not active')
  }

  // 2. 解密服务端的 DATA_KEY
  const dataKey = decryptWithKek(
    device.encrypted_data_key,
    device.encrypted_data_key_nonce,
    `goray-device-data-key\n${device.id}\n${device.data_key_id}`,
    1
  )

  // 3. 查询所有上线节点
  const nodes = await goraySql<NodeRecord[]>`
    SELECT 
      id, display_name, country_code, region, protocol,
      encrypted_config, config_nonce, config_key_version,
      weight, display_order, status, health_status
    FROM goray_nodes
    WHERE status = 'online'
    ORDER BY display_order ASC, weight DESC, created_at ASC
  `

  // 4. 解密节点配置并组装明文列表
  const plaintextNodes = nodes.map((n) => {
    let conf: NodeSecretConfig
    try {
      const dec = decryptWithKek(
        n.encrypted_config,
        n.config_nonce,
        `goray-node-config\n${n.id}\n${n.config_key_version}`,
        n.config_key_version
      )
      conf = JSON.parse(dec.toString('utf8'))
    } catch {
      conf = {
        server_addr: 'unavailable',
        server_port: 443,
        protocol: n.protocol,
      }
    }

    return {
      id: n.id,
      name: n.display_name,
      country_code: n.country_code,
      region: n.region || '',
      protocol: n.protocol,
      server_addr: conf.server_addr,
      server_port: conf.server_port,
      uuid: conf.uuid,
      password: conf.password,
      security: conf.security || 'auto',
      ws_path: conf.ws_path || '/',
      ws_host: conf.ws_host || conf.server_addr,
      tls_enabled: conf.tls_enabled !== false,
      sni: conf.sni || conf.server_addr,
      utls_fingerprint: conf.utls_fingerprint || 'chrome',
      obfs: conf.obfs,
      obfs_password: conf.obfs_password,
      health_status: n.health_status,
      weight: n.weight,
      display_order: n.display_order,
    }
  })

  // 5. 按照 API Payload AAD 规则加密
  const serverTime = Math.floor(Date.now() / 1000)
  const envelope = encryptApiPayload(
    dataKey,
    device.data_key_id,
    { nodes: plaintextNodes },
    'GET',
    '/api/goray/v1/nodes',
    requestId,
    serverTime,
    deviceId
  )

  return envelope
}
