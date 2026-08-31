import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { fromBase64Url, toBase64Url } from '../crypto/base64url'
import { DPoPJwk, computeJwkThumbprint } from '../crypto/dpop'
import { createKeyEnvelope } from '../crypto/ecdh'
import { hashDeviceCode, hashUserCode } from '../crypto/hmac'
import { encryptWithKek } from '../crypto/kek'
import { goraySql } from '../db/pg'
import { enforceDeviceLimit, getEffectiveEntitlement } from '../entitlements/service'
import { Errors } from '../shared/errors'
import { issueAccessToken, issueRefreshToken } from './tokenService'

const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789'

const generateUserCode = (): string => {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length]
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`
}

export interface InitiateDeviceAuthInput {
  device_name: string
  platform: 'android' | 'ios' | 'windows' | 'macos'
  app_version: string
  encryption_public_key_spki: string // base64url
  proof_public_jwk: DPoPJwk
}

export interface DeviceAuthResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export const initiateDeviceAuthorization = async (
  input: InitiateDeviceAuthInput,
  origin = 'https://goray.org'
): Promise<DeviceAuthResponse> => {
  const deviceCode = toBase64Url(randomBytes(32))
  const userCode = generateUserCode()
  const deviceId = randomUUID()

  const deviceCodeHash = hashDeviceCode(deviceCode)
  const userCodeHash = hashUserCode(userCode)

  const spkiBuf = fromBase64Url(input.encryption_public_key_spki)
  const encryptionKeyThumbprint = createHash('sha256').update(spkiBuf).digest('hex')
  const proofKeyJkt = computeJwkThumbprint(input.proof_public_jwk)

  const expiresAt = new Date(Date.now() + 600 * 1000) // 10 分钟

  await goraySql`
    INSERT INTO goray_device_authorizations (
      device_code_hash, user_code_hash, device_id, device_name,
      platform, app_version, encryption_public_key_spki, encryption_key_thumbprint,
      proof_public_jwk, proof_key_jkt, status, expires_at
    ) VALUES (
      ${deviceCodeHash}, ${userCodeHash}, ${deviceId}, ${input.device_name},
      ${input.platform}, ${input.app_version}, ${spkiBuf}, ${encryptionKeyThumbprint},
      ${JSON.stringify(input.proof_public_jwk)}, ${proofKeyJkt}, 'pending', ${expiresAt}
    )
  `

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${origin}/activate`,
    expires_in: 600,
    interval: 5,
  }
}

export const lookupDeviceAuthByUserCode = async (userCode: string) => {
  const userCodeHash = hashUserCode(userCode)
  const [row] = await goraySql<{
    id: string
    device_name: string
    platform: string
    app_version: string
    expires_at: Date
    status: string
  }[]>`
    SELECT id, device_name, platform, app_version, expires_at, status
    FROM goray_device_authorizations
    WHERE user_code_hash = ${userCodeHash}
  `

  if (!row) {
    throw Errors.notFound('Invalid or expired device code')
  }

  if (row.status !== 'pending' || new Date(row.expires_at) <= new Date()) {
    throw Errors.badRequest('Device authorization code has expired or already been processed')
  }

  return {
    id: row.id,
    device_name: row.device_name,
    platform: row.platform,
    app_version: row.app_version,
    expires_at: row.expires_at,
  }
}

export const confirmDeviceAuthorization = async (authId: string, apayUserId: number, approved: boolean): Promise<void> => {
  if (!approved) {
    await goraySql`
      UPDATE goray_device_authorizations
      SET status = 'denied'
      WHERE id = ${authId} AND status = 'pending'
    `
    return
  }

  // 1. 检查用户是否有有效权益
  const entitlementResult = await getEffectiveEntitlement(apayUserId)
  if (!entitlementResult.isUsable || !entitlementResult.entitlement) {
    throw Errors.entitlementRequired('Active subscription is required to authorize devices')
  }

  const maxDevices = entitlementResult.deviceLimit

  // 2. 事务内检查并锁定设备配额
  await goraySql.begin(async (tx) => {
    const [auth] = await tx<{ id: string; status: string; expires_at: Date }[]>`
      SELECT id, status, expires_at
      FROM goray_device_authorizations
      WHERE id = ${authId}
      FOR UPDATE
    `

    if (!auth || auth.status !== 'pending' || new Date(auth.expires_at) <= new Date()) {
      throw Errors.badRequest('Authorization expired or invalid')
    }

    const [countRow] = await tx<{ count: number }[]>`
      SELECT count(*)::int as count FROM goray_devices
      WHERE apay_user_id = ${apayUserId} AND status = 'active'
    `
    const currentActive = countRow?.count || 0
    if (currentActive >= maxDevices) {
      throw Errors.deviceLimitExceeded(`Device limit of ${maxDevices} exceeded. Please manage devices in your profile.`)
    }

    await tx`
      UPDATE goray_device_authorizations
      SET status = 'approved',
          approved_at = NOW(),
          apay_user_id = ${apayUserId}
      WHERE id = ${authId}
    `
  })
}

export const consumeDeviceAuthorization = async (deviceCode: string, proofJkt: string) => {
  const deviceCodeHash = hashDeviceCode(deviceCode)

  return await goraySql.begin(async (tx) => {
    const [auth] = await tx<{
      id: string
      device_id: string
      device_name: string
      platform: 'android' | 'ios' | 'windows' | 'macos'
      app_version: string
      encryption_public_key_spki: Buffer
      encryption_key_thumbprint: string
      proof_public_jwk: DPoPJwk
      proof_key_jkt: string
      apay_user_id: number | null
      status: string
      expires_at: Date
    }[]>`
      SELECT 
        id, device_id, device_name, platform, app_version,
        encryption_public_key_spki, encryption_key_thumbprint,
        proof_public_jwk, proof_key_jkt, apay_user_id, status, expires_at
      FROM goray_device_authorizations
      WHERE device_code_hash = ${deviceCodeHash}
      FOR UPDATE
    `

    if (!auth) {
      throw Errors.badRequest('Invalid device code')
    }

    if (new Date(auth.expires_at) <= new Date()) {
      throw Errors.badRequest('Device code expired')
    }

    if (auth.status === 'pending') {
      throw Errors.badRequest('Authorization pending', 40001)
    }

    if (auth.status === 'denied') {
      throw Errors.forbidden('Access denied by user', 40300)
    }

    if (auth.status === 'consumed') {
      throw Errors.badRequest('Authorization already consumed', 40002)
    }

    if (auth.status !== 'approved' || !auth.apay_user_id) {
      throw Errors.badRequest('Invalid authorization state')
    }

    if (auth.proof_key_jkt !== proofJkt) {
      throw Errors.dpopFailed('DPoP key thumbprint does not match authorization')
    }

    // 1. 生成 32 字节随机 DATA_KEY
    const rawDataKey = randomBytes(32)
    const dataKeyId = randomUUID()

    // 2. 用服务端 KEK 加密暂存 DATA_KEY
    const kekEnc = encryptWithKek(rawDataKey, `goray-device-data-key\n${auth.device_id}\n${dataKeyId}`)

    // 3. 用设备 P-256 公钥做 ECDH 封装为 key envelope 下发给设备
    const keyEnvelope = createKeyEnvelope(
      auth.encryption_public_key_spki,
      auth.device_id,
      dataKeyId,
      1,
      rawDataKey
    )

    // 4. 写入/激活 device
    await tx`
      INSERT INTO goray_devices (
        id, apay_user_id, name, platform, app_version,
        encryption_public_key_spki, encryption_key_thumbprint,
        proof_public_jwk, proof_key_jkt,
        data_key_id, encrypted_data_key, encrypted_data_key_nonce,
        key_version, status, last_seen_at
      ) VALUES (
        ${auth.device_id}, ${auth.apay_user_id}, ${auth.device_name}, ${auth.platform}, ${auth.app_version},
        ${auth.encryption_public_key_spki}, ${auth.encryption_key_thumbprint},
        ${JSON.stringify(auth.proof_public_jwk)}, ${auth.proof_key_jkt},
        ${dataKeyId}, ${kekEnc.ciphertext}, ${kekEnc.nonce},
        1, 'active', NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        app_version = EXCLUDED.app_version,
        data_key_id = EXCLUDED.data_key_id,
        encrypted_data_key = EXCLUDED.encrypted_data_key,
        encrypted_data_key_nonce = EXCLUDED.encrypted_data_key_nonce,
        status = 'active',
        last_seen_at = NOW(),
        updated_at = NOW()
    `

    // 5. 标记授权为已消费
    await tx`
      UPDATE goray_device_authorizations
      SET status = 'consumed',
          consumed_at = NOW()
      WHERE id = ${auth.id}
    `

    // 6. 签发 Access Token 与 Refresh Token
    const accessToken = issueAccessToken(auth.device_id, auth.apay_user_id, auth.proof_key_jkt)
    const { rawToken: refreshToken } = await issueRefreshToken(auth.device_id)

    // 7. 确保设备上限
    await enforceDeviceLimit(auth.apay_user_id, 100)

    return {
      access_token: accessToken,
      token_type: 'DPoP',
      expires_in: 900,
      refresh_token: refreshToken,
      key_envelope: keyEnvelope,
    }
  })
}
