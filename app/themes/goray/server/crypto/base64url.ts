import { Buffer } from 'node:buffer'

export const toBase64Url = (buffer: Buffer | Uint8Array | string): string => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  return buf.toString('base64url')
}

export const fromBase64Url = (base64url: string): Buffer => {
  return Buffer.from(base64url, 'base64url')
}
