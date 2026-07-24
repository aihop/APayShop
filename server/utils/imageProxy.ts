import { createError } from 'h3'

const DEFAULT_ALLOWED_HOSTS = [
  'alicdn.com',
  'alibabausercontent.com',
  '1688.com',
  'tbcdn.cn',
  'taobaocdn.com',
  'pinduoduo.com',
  'yangkeduo.com',
  'aliyuncs.com',
] as const

const REFERER_RULES = [
  { host: 'alicdn.com', referer: 'https://www.1688.com/' },
  { host: 'alibabausercontent.com', referer: 'https://www.1688.com/' },
  { host: '1688.com', referer: 'https://www.1688.com/' },
  { host: 'tbcdn.cn', referer: 'https://www.taobao.com/' },
  { host: 'taobaocdn.com', referer: 'https://www.taobao.com/' },
  { host: 'pinduoduo.com', referer: 'https://www.pinduoduo.com/' },
  { host: 'yangkeduo.com', referer: 'https://www.pinduoduo.com/' },
] as const

const normalizeAllowedHosts = () => {
  const fromEnv = String(process.env.APAY_IMAGE_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)

  return fromEnv.length ? fromEnv : [...DEFAULT_ALLOWED_HOSTS]
}

const isHostAllowed = (hostname: string, allowedHosts: readonly string[]) => (
  allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
)

export const normalizeImageProxyUrl = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: missing url' })
  }

  const normalized = raw.startsWith('//') ? `https:${raw}` : raw
  let target: URL

  try {
    target = new URL(normalized)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: invalid url' })
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: unsupported protocol' })
  }

  if (target.username || target.password) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: invalid url' })
  }

  const allowedHosts = normalizeAllowedHosts()
  const hostname = target.hostname.toLowerCase()

  if (!isHostAllowed(hostname, allowedHosts)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: host is not allowed' })
  }

  return target
}

export const getImageProxyReferer = (target: URL) => {
  const hostname = target.hostname.toLowerCase()
  const matched = REFERER_RULES.find(rule => hostname === rule.host || hostname.endsWith(`.${rule.host}`))
  return matched?.referer || target.origin
}
