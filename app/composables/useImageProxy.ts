const PROXY_ENDPOINT = '/api/proxy/image'

export const useImageProxy = () => {
  const buildImageProxyUrl = (value: string | null | undefined) => {
    const raw = String(value || '').trim()
    if (!raw) return ''

    if (raw.startsWith('/')) return raw

    const normalized = raw.startsWith('//') ? `https:${raw}` : raw
    if (!/^https?:\/\//i.test(normalized)) return normalized

    return `${PROXY_ENDPOINT}?url=${encodeURIComponent(normalized)}`
  }

  return {
    buildImageProxyUrl,
  }
}
