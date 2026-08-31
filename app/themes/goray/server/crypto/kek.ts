import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { fromBase64Url, toBase64Url } from './base64url'

const normalizeEnv = (val?: string) => (val || '').replace(/"/g, '').trim()

export const getMasterKey = (): Buffer => {
  const rawKey = normalizeEnv(process.env.GORAY_MASTER_KEY || process.env.APP_KEY)
  if (!rawKey) {
    // 若未配置，在开发环境生成警告，生产抛出错误
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[goray-crypto] GORAY_MASTER_KEY must be configured in production.')
    }
    // 固定的开发 fallback 密钥（32 字节）
    return Buffer.from('01234567890123456789012345678901', 'utf8')
  }

  // 支持 Base64 / Hex / UTF-8
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  try {
    const b64 = Buffer.from(rawKey, 'base64')
    if (b64.length === 32) return b64
  } catch {}

  const buf = Buffer.from(rawKey, 'utf8')
  if (buf.length >= 32) return buf.subarray(0, 32)

  // 补齐 32 字节
  const padded = Buffer.alloc(32)
  buf.copy(padded)
  return padded
}

export interface EncryptedPayload {
  ciphertext: Buffer
  nonce: Buffer
  keyVersion: number
}

export const encryptWithKek = (plaintext: Buffer | string, aad: string, keyVersion = 1): EncryptedPayload => {
  const key = getMasterKey()
  const nonce = randomBytes(12)
  const plainBuf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8')

  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertextPart = cipher.update(plainBuf)
  const finalPart = cipher.final()
  const tag = cipher.getAuthTag()

  const ciphertext = Buffer.concat([ciphertextPart, finalPart, tag])
  return { ciphertext, nonce, keyVersion }
}

export const decryptWithKek = (ciphertextWithTag: Buffer, nonce: Buffer, aad: string, _keyVersion = 1): Buffer => {
  const key = getMasterKey()
  if (ciphertextWithTag.length < 16) {
    throw new Error('Ciphertext is too short (must include 16-byte tag)')
  }
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16)
  const actualCiphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)

  const decryptedPart = decipher.update(actualCiphertext)
  const finalPart = decipher.final()
  return Buffer.concat([decryptedPart, finalPart])
}
