import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { fromBase64Url, toBase64Url } from './base64url'

export interface KeyEnvelope {
  v: 1
  alg: 'ECDH-P256+HKDF-SHA256+A256GCM'
  key_id: string
  key_version: number
  server_ephemeral_public_key: string
  salt: string
  nonce: string
  ciphertext: string
}

export interface ApiPayloadEnvelope {
  v: 1
  alg: 'A256GCM'
  key_id: string
  nonce: string
  ciphertext: string
}

export const createKeyEnvelope = (
  deviceEncryptionPublicKeySpki: Buffer,
  deviceId: string,
  keyId: string,
  keyVersion: number,
  dataKey: Buffer
): KeyEnvelope => {
  // 生成临时 P-256 密钥对
  const { publicKey: serverPubKey, privateKey: serverPrivKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  // 使用 node:crypto ecdh 计算共享密钥
  // 从 SPKI DER 提取原始公钥点 (65 bytes 0x04...)
  const rawClientPubKey = extractRawEcPublicKey(deviceEncryptionPublicKeySpki)
  const rawServerPrivKey = extractRawEcPrivateKey(serverPrivKey)

  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(rawServerPrivKey)
  const sharedSecret = ecdh.computeSecret(rawClientPubKey)

  const salt = randomBytes(32)
  const info = Buffer.from(`goray:key-wrap:v1:${deviceId}:${keyId}`, 'utf8')
  const wrapKey = Buffer.from(hkdfSync('sha256', sharedSecret, salt, info, 32))

  const nonce = randomBytes(12)
  const aad = Buffer.from(`goray-key-envelope-v1\n${deviceId}\n${keyId}\n${keyVersion}`, 'utf8')

  const cipher = createCipheriv('aes-256-gcm', wrapKey, nonce)
  cipher.setAAD(aad)
  const ciphertextPart = cipher.update(dataKey)
  const finalPart = cipher.final()
  const tag = cipher.getAuthTag()
  const ciphertext = Buffer.concat([ciphertextPart, finalPart, tag])

  return {
    v: 1,
    alg: 'ECDH-P256+HKDF-SHA256+A256GCM',
    key_id: keyId,
    key_version: keyVersion,
    server_ephemeral_public_key: toBase64Url(serverPubKey),
    salt: toBase64Url(salt),
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(ciphertext),
  }
}

export const encryptApiPayload = (
  dataKey: Buffer,
  keyId: string,
  plaintextJson: string | object,
  method: string,
  normalizedPath: string,
  requestId: string,
  serverTime: number,
  deviceId: string
): ApiPayloadEnvelope => {
  const nonce = randomBytes(12)
  const text = typeof plaintextJson === 'string' ? plaintextJson : JSON.stringify(plaintextJson)
  const plainBuf = Buffer.from(text, 'utf8')

  const aad = Buffer.from(
    `goray-response-v1\n${method.toUpperCase()}\n${normalizedPath}\n${requestId}\n${serverTime}\n${deviceId}\n${keyId}`,
    'utf8'
  )

  const cipher = createCipheriv('aes-256-gcm', dataKey, nonce)
  cipher.setAAD(aad)
  const ciphertextPart = cipher.update(plainBuf)
  const finalPart = cipher.final()
  const tag = cipher.getAuthTag()
  const ciphertext = Buffer.concat([ciphertextPart, finalPart, tag])

  return {
    v: 1,
    alg: 'A256GCM',
    key_id: keyId,
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(ciphertext),
  }
}

export const decryptApiPayload = (
  dataKey: Buffer,
  envelope: { key_id: string; nonce: string; ciphertext: string },
  method: string,
  normalizedPath: string,
  requestId: string,
  clientTime: number,
  deviceId: string
): string => {
  const nonce = fromBase64Url(envelope.nonce)
  const rawCiphertext = fromBase64Url(envelope.ciphertext)
  if (rawCiphertext.length < 16) {
    throw new Error('Ciphertext too short')
  }

  const tag = rawCiphertext.subarray(rawCiphertext.length - 16)
  const ciphertext = rawCiphertext.subarray(0, rawCiphertext.length - 16)

  const aad = Buffer.from(
    `goray-request-v1\n${method.toUpperCase()}\n${normalizedPath}\n${requestId}\n${clientTime}\n${deviceId}\n${envelope.key_id}`,
    'utf8'
  )

  const decipher = createDecipheriv('aes-256-gcm', dataKey, nonce)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

// SPKI DER 格式中提取 P-256 65 字节未压缩公钥点 (0x04...)
function extractRawEcPublicKey(spkiDer: Buffer): Buffer {
  if (spkiDer.length === 65 && spkiDer[0] === 0x04) {
    return spkiDer
  }
  // 标准 P-256 SPKI 长度 91 字节，最后 65 字节是原始点
  if (spkiDer.length >= 65) {
    return spkiDer.subarray(spkiDer.length - 65)
  }
  throw new Error('Invalid SPKI public key length')
}

// PKCS#8 DER 格式提取 P-256 32 字节私钥
function extractRawEcPrivateKey(pkcs8Der: Buffer): Buffer {
  if (pkcs8Der.length === 32) {
    return pkcs8Der
  }
  // 标准 P-256 PKCS#8，私钥位于固定偏移或末尾
  // 一般在 0x04, 0x20, [32 bytes private key] 之后
  for (let i = 0; i < pkcs8Der.length - 34; i++) {
    if (pkcs8Der[i] === 0x04 && pkcs8Der[i + 1] === 0x20) {
      return pkcs8Der.subarray(i + 2, i + 2 + 32)
    }
  }
  if (pkcs8Der.length >= 32) {
    return pkcs8Der.subarray(pkcs8Der.length - 32)
  }
  throw new Error('Invalid PKCS8 private key length')
}
