import { createHmac } from 'node:crypto'
import { toBase64Url } from './base64url'

const normalizeEnv = (val?: string) => (val || '').replace(/"/g, '').trim()

export const getPepper = (name: string): string => {
  return normalizeEnv(process.env[`GORAY_PEPPER_${name.toUpperCase()}`]) || `default_goray_pepper_${name}_v1`
}

export const hmacSha256 = (key: string | Buffer, data: string | Buffer): Buffer => {
  return createHmac('sha256', key).update(data).digest()
}

export const hmacHex = (key: string | Buffer, data: string | Buffer): string => {
  return createHmac('sha256', key).update(data).digest('hex')
}

export const hmacBase64Url = (key: string | Buffer, data: string | Buffer): string => {
  return toBase64Url(hmacSha256(key, data))
}

export const hashDeviceCode = (deviceCode: string): string => {
  return hmacHex(getPepper('device_code'), deviceCode)
}

export const hashUserCode = (userCode: string): string => {
  return hmacHex(getPepper('user_code'), userCode.toUpperCase().trim())
}

export const hashCode = (code: string): string => {
  return hmacHex(getPepper('redeem_code'), code.toUpperCase().trim())
}

export const hashDeletionSubject = (apayUserId: string | number): string => {
  return hmacHex(getPepper('deletion'), `apay-user:${apayUserId}`)
}

export const verifyWebhookHmac = (
  rawBody: string | Buffer,
  signatureHeader: string,
  secret = normalizeEnv(process.env.GORAY_WEBHOOK_SECRET || process.env.APAY_INTEGRATION_TOKEN)
): boolean => {
  if (!secret) return false
  const expectedSig = hmacHex(secret, rawBody)
  const incomingSig = signatureHeader.replace(/^sha256=/i, '').trim()
  return expectedSig.toLowerCase() === incomingSig.toLowerCase()
}
