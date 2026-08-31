import { Buffer } from 'node:buffer'
import { createHmac, createHash, randomBytes, randomUUID } from 'node:crypto'
import { fromBase64Url, toBase64Url } from '../crypto/base64url'
import { goraySql } from '../db/pg'
import { Errors } from '../shared/errors'

const normalizeEnv = (val?: string) => (val || '').replace(/"/g, '').trim()
const getJwtSecret = () => normalizeEnv(process.env.GORAY_JWT_SECRET || process.env.GORAY_MASTER_KEY || 'goray_default_jwt_secret_v1')

export interface AccessTokenClaims {
  sub: string // device_id
  uid: number // apay_user_id
  cnf: { jkt: string } // DPoP JWK Thumbprint
  iss: 'goray'
  iat: number
  exp: number
  jti: string
}

/**
 * 签发 15 分钟 DPoP 绑定的 Access Token (HS256)
 */
export const issueAccessToken = (deviceId: string, apayUserId: number, jkt: string): string => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const nowSec = Math.floor(Date.now() / 1000)
  const payload: AccessTokenClaims = {
    sub: deviceId,
    uid: apayUserId,
    cnf: { jkt },
    iss: 'goray',
    iat: nowSec,
    exp: nowSec + 900, // 15 分钟
    jti: randomUUID(),
  }

  const headerB64 = toBase64Url(JSON.stringify(header))
  const payloadB64 = toBase64Url(JSON.stringify(payload))
  const signature = createHmac('sha256', getJwtSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest()
  const sigB64 = toBase64Url(signature)

  return `${headerB64}.${payloadB64}.${sigB64}`
}

/**
 * 校验 Access Token 并验证 DPoP JKT 绑定
 */
export const verifyAccessToken = (tokenString: string, expectedJkt?: string): AccessTokenClaims => {
  const parts = tokenString.split('.')
  if (parts.length !== 3) {
    throw Errors.unauthorized('Invalid access token format')
  }

  const [headerB64, payloadB64, sigB64] = parts
  const expectedSig = createHmac('sha256', getJwtSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest()

  if (toBase64Url(expectedSig) !== sigB64) {
    throw Errors.unauthorized('Invalid access token signature')
  }

  const payload: AccessTokenClaims = JSON.parse(fromBase64Url(payloadB64).toString('utf8'))
  const nowSec = Math.floor(Date.now() / 1000)

  if (nowSec > payload.exp) {
    throw Errors.tokenExpired('Access token expired')
  }

  if (expectedJkt && payload.cnf?.jkt !== expectedJkt) {
    throw Errors.dpopFailed('Access token JKT does not match DPoP proof key')
  }

  return payload
}

/**
 * 签发全新 Refresh Token 家族
 */
export const issueRefreshToken = async (deviceId: string, familyId = randomUUID()): Promise<{ rawToken: string; expiresAt: Date }> => {
  const rawBytes = randomBytes(32)
  const rawToken = toBase64Url(rawBytes)
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000) // 30 天

  await goraySql`
    INSERT INTO goray_refresh_tokens (
      device_id, family_id, token_hash, expires_at
    ) VALUES (
      ${deviceId}, ${familyId}, ${tokenHash}, ${expiresAt}
    )
  `

  return { rawToken, expiresAt }
}

/**
 * 轮换 Refresh Token（检测重放并注销 Token 家族）
 */
export const rotateRefreshToken = async (
  rawOldToken: string,
  deviceId: string
): Promise<{ rawToken: string; familyId: string }> => {
  const oldHash = createHash('sha256').update(rawOldToken).digest('hex')

  return await goraySql.begin(async (tx) => {
    const [tokenRecord] = await tx<{
      id: string
      device_id: string
      family_id: string
      expires_at: Date
      used_at: Date | null
      revoked_at: Date | null
    }[]>`
      SELECT id, device_id, family_id, expires_at, used_at, revoked_at
      FROM goray_refresh_tokens
      WHERE token_hash = ${oldHash}
      FOR UPDATE
    `

    if (!tokenRecord) {
      throw Errors.unauthorized('Invalid refresh token')
    }

    if (tokenRecord.device_id !== deviceId) {
      throw Errors.unauthorized('Device mismatch for refresh token')
    }

    // 重放检测：如果已经被使用过或已撤销，撤销整个家族并拒绝
    if (tokenRecord.used_at !== null || tokenRecord.revoked_at !== null) {
      await tx`
        UPDATE goray_refresh_tokens
        SET revoked_at = NOW()
        WHERE family_id = ${tokenRecord.family_id}
      `
      throw Errors.unauthorized('Refresh token replay detected. Family revoked.')
    }

    if (new Date(tokenRecord.expires_at) <= new Date()) {
      throw Errors.unauthorized('Refresh token expired')
    }

    // 标记当前 Token 为已使用
    await tx`
      UPDATE goray_refresh_tokens
      SET used_at = NOW()
      WHERE id = ${tokenRecord.id}
    `

    // 生成家族内的新 Token
    const rawBytes = randomBytes(32)
    const newRawToken = toBase64Url(rawBytes)
    const newHash = createHash('sha256').update(newRawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 86400 * 1000)

    await tx`
      INSERT INTO goray_refresh_tokens (
        device_id, family_id, token_hash, parent_token_id, expires_at
      ) VALUES (
        ${deviceId}, ${tokenRecord.family_id}, ${newHash}, ${tokenRecord.id}, ${expiresAt}
      )
    `

    return { rawToken: newRawToken, familyId: tokenRecord.family_id }
  })
}
