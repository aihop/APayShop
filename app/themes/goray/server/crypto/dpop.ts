import { Buffer } from 'node:buffer'
import { createHash, createPublicKey, createVerify } from 'node:crypto'
import { fromBase64Url, toBase64Url } from './base64url'

export interface DPoPJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

export interface DPoPHeader {
  typ: string
  alg: string
  jwk: DPoPJwk
}

export interface DPoPPayload {
  jti: string
  htm: string
  htu: string
  iat: number
  ath?: string
  nonce?: string
}

export const computeJwkThumbprint = (jwk: DPoPJwk): string => {
  // Canonical JSON representation for EC P-256 JWK
  const canonical = `{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`
  const hash = createHash('sha256').update(canonical, 'utf8').digest()
  return toBase64Url(hash)
}

export const verifyDPoPProof = (
  dpopJwt: string,
  expectedMethod: string,
  expectedPath: string,
  expectedJkt?: string,
  accessToken?: string
): { jkt: string; payload: DPoPPayload } => {
  const parts = dpopJwt.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid DPoP JWT format (must have 3 parts)')
  }

  const [headerB64, payloadB64, signatureB64] = parts
  const headerJson = fromBase64Url(headerB64).toString('utf8')
  const payloadJson = fromBase64Url(payloadB64).toString('utf8')

  const header: DPoPHeader = JSON.parse(headerJson)
  const payload: DPoPPayload = JSON.parse(payloadJson)

  if (header.typ?.toLowerCase() !== 'dpop+jwt') {
    throw new Error(`Invalid DPoP header typ: ${header.typ}`)
  }
  if (header.alg !== 'ES256') {
    throw new Error(`Unsupported DPoP header alg: ${header.alg}`)
  }
  if (!header.jwk || header.jwk.kty !== 'EC' || header.jwk.crv !== 'P-256') {
    throw new Error('Invalid DPoP JWK in header')
  }

  const jkt = computeJwkThumbprint(header.jwk)
  if (expectedJkt && jkt !== expectedJkt) {
    throw new Error(`DPoP JKT mismatch: expected ${expectedJkt}, got ${jkt}`)
  }

  // 校验 HTTP Method
  if (payload.htm?.toUpperCase() !== expectedMethod.toUpperCase()) {
    throw new Error(`DPoP htm mismatch: expected ${expectedMethod}, got ${payload.htm}`)
  }

  // 校验 HTTP URI/Path（忽略 host/query）
  const payloadPath = payload.htu?.startsWith('http') ? new URL(payload.htu).pathname : payload.htu
  const normExpectedPath = expectedPath.split('?')[0]
  if (payloadPath !== normExpectedPath && !payload.htu?.includes(normExpectedPath)) {
    throw new Error(`DPoP htu mismatch: expected ${normExpectedPath}, got ${payload.htu}`)
  }

  // 校验时间
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - (payload.iat || 0)) > 300) {
    throw new Error('DPoP proof expired or timestamp skewed beyond 300s')
  }

  // 校验 ath (如果要求)
  if (accessToken) {
    const expectedAth = toBase64Url(createHash('sha256').update(accessToken, 'utf8').digest())
    if (payload.ath && payload.ath !== expectedAth) {
      throw new Error('DPoP ath mismatch')
    }
  }

  // 验签
  const jwk = header.jwk
  const jwkPublicKey = createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: jwk.x,
      y: jwk.y,
    },
    format: 'jwk',
  })

  // 将 raw R || S (64 bytes) 转为 IEEE P1363 / DER
  const rawSig = fromBase64Url(signatureB64)
  const verifier = createVerify('SHA256')
  verifier.update(`${headerB64}.${payloadB64}`)
  
  const isValid = verifier.verify({
    key: jwkPublicKey,
    dsaEncoding: 'ieee-p1363',
  }, rawSig)

  if (!isValid) {
    throw new Error('DPoP proof signature verification failed')
  }

  return { jkt, payload }
}
