import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { getImageProxyReferer, normalizeImageProxyUrl } from '../../utils/imageProxy'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const targetUrl = normalizeImageProxyUrl(query.url)

  const upstream = await fetch(targetUrl.toString(), {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: getImageProxyReferer(targetUrl),
      'User-Agent': 'APay-ImageProxy/1.0',
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!upstream.ok) {
    throw createError({
      statusCode: upstream.status === 404 ? 404 : 502,
      statusMessage: locale === 'zh'
        ? `上游图片请求失败（${upstream.status}）`
        : `Upstream image request failed (${upstream.status})`,
    })
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=3600, s-maxage=86400'
  const etag = upstream.headers.get('etag')
  const lastModified = upstream.headers.get('last-modified')

  setResponseHeader(event, 'content-type', contentType)
  setResponseHeader(event, 'cache-control', cacheControl)
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cross-origin-resource-policy', 'cross-origin')
  setResponseHeader(event, 'x-robots-tag', 'noindex')
  if (etag) setResponseHeader(event, 'etag', etag)
  if (lastModified) setResponseHeader(event, 'last-modified', lastModified)

  const arrayBuffer = await upstream.arrayBuffer()
  return Buffer.from(arrayBuffer)
})
