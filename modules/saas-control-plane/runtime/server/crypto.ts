
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const bytesToBase64 = (value: Uint8Array) => {
  let binary = ''
  value.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), character => character.charCodeAt(0))

const resolveKey = async (secret: string) => {
  if (secret.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'APAY_SAAS_CREDENTIAL_KEY must contain at least 32 characters',
    })
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export const encryptCredential = async (value: string, masterSecret: string) => {
  const key = await resolveKey(masterSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value))
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

export const decryptCredential = async (value: string, masterSecret: string) => {
  const [version, iv, ciphertext] = value.split('.')
  if (version !== 'v1' || !iv || !ciphertext) {
    throw createError({ statusCode: 500, statusMessage: 'Stored SaaS credential is invalid' })
  }
  try {
    const key = await resolveKey(masterSecret)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext),
    )
    return decoder.decode(decrypted)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 503, statusMessage: 'Unable to decrypt SaaS credential' })
  }
}

export const credentialPreview = (value: string) => {
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
