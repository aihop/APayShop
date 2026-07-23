const PROXY_ENDPOINT = '/api/proxy/image'
const PROXIED_IMAGE_HOSTS = [
  'alicdn.com',
  'alibabausercontent.com',
  '1688pic.com',
  'tbcdn.cn',
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

    if (raw.startsWith('/')) return raw

    const normalized = raw.startsWith('//') ? `https:${raw}` : raw
    if (!/^https?:\/\//i.test(normalized)) return normalized

    if (!shouldProxyImage(normalized)) return normalized

    return `${PROXY_ENDPOINT}?url=${encodeURIComponent(normalized)}`
  }

  return {
    buildImageProxyUrl,
  }
}
