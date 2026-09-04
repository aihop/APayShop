const PROXY_ENDPOINT = '/api/proxy/image'
const PROXIED_IMAGE_HOSTS = [
  'alicdn.com',
  'alibabausercontent.com',
  '1688.com',
  '1688pic.com',
  'tbcdn.cn',
  'taobaocdn.com',
  'pinduoduo.com',
  'yangkeduo.com',
  'aliyuncs.com',
] as const

const shouldProxyImage = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return PROXIED_IMAGE_HOSTS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  }
  catch {
    return false
  }
}

export const useImageProxy = () => {
  const buildImageProxyUrl = (value: string | null | undefined) => {
    const raw = String(value || '')
      .replace(/[`'"]/g, '')
      .trim()
    if (!raw) return ''

    const normalized = raw.startsWith('//') ? `https:${raw}` : raw
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    if (!/^https?:\/\//i.test(normalized)) return normalized

    if (!shouldProxyImage(normalized)) return normalized

    return `${PROXY_ENDPOINT}?url=${encodeURIComponent(normalized)}`
  }

  return {
    buildImageProxyUrl,
  }
}
