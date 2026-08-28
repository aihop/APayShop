import { createHash } from 'node:crypto'
import { defineEventHandler, getHeader, getQuery, setResponseHeader, setResponseStatus } from 'h3'
import { getImageProxyReferer, normalizeImageProxyUrl } from '../../utils/imageProxy'
import { getRequestLocale } from '../../utils/requestLocale'

interface CachedImageEntry {
  buffer: Buffer
  contentType: string
  etag: string
  lastModified?: string
  expiresAt: number
}

// 服务端内存 LRU 缓存：最大缓存 500 张热点图片，TTL 24 小时
const MAX_CACHE_ENTRIES = 500
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const imageMemoryCache = new Map<string, CachedImageEntry>()

const getFromCache = (key: string): CachedImageEntry | null => {
  const entry = imageMemoryCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    imageMemoryCache.delete(key)
    return null
  }
  // LRU 访问刷新
  imageMemoryCache.delete(key)
  imageMemoryCache.set(key, entry)
  return entry
}

const setToCache = (key: string, entry: CachedImageEntry) => {
  if (imageMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = imageMemoryCache.keys().next().value
    if (oldestKey) imageMemoryCache.delete(oldestKey)
  }
  imageMemoryCache.set(key, entry)
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const targetUrl = normalizeImageProxyUrl(query.url)
  const cacheKey = targetUrl.toString()

  // 1. 检查服务端内存缓存
  const cached = getFromCache(cacheKey)
  if (cached) {
    const clientEtag = getHeader(event, 'if-none-match')
    if (clientEtag && (clientEtag === cached.etag || clientEtag === `W/${cached.etag}`)) {
      setResponseStatus(event, 304)
      return null
    }

    setResponseHeader(event, 'content-type', cached.contentType)
    setResponseHeader(event, 'cache-control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    setResponseHeader(event, 'access-control-allow-origin', '*')
    setResponseHeader(event, 'cross-origin-resource-policy', 'cross-origin')
    setResponseHeader(event, 'x-robots-tag', 'noindex')
    setResponseHeader(event, 'x-image-proxy-cache', 'HIT')
    setResponseHeader(event, 'etag', cached.etag)
    if (cached.lastModified) setResponseHeader(event, 'last-modified', cached.lastModified)
    return cached.buffer
  }

  // 2. 未命中缓存，发起上游请求
  const upstream = await fetch(cacheKey, {
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

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await upstream.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 计算内容 ETag
  const digest = createHash('md5').update(buffer).digest('hex')
  const etag = `"${digest}"`
  const lastModified = upstream.headers.get('last-modified') || new Date().toUTCString()

  // 写入服务端内存缓存
  setToCache(cacheKey, {
    buffer,
    contentType,
    etag,
    lastModified,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  // 3. 检查客户端 304 协商缓存
  const clientEtag = getHeader(event, 'if-none-match')
  if (clientEtag && (clientEtag === etag || clientEtag === `W/${etag}`)) {
    setResponseStatus(event, 304)
    return null
  }

  setResponseHeader(event, 'content-type', contentType)
  setResponseHeader(event, 'cache-control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cross-origin-resource-policy', 'cross-origin')
  setResponseHeader(event, 'x-robots-tag', 'noindex')
  setResponseHeader(event, 'x-image-proxy-cache', 'MISS')
  setResponseHeader(event, 'etag', etag)
  setResponseHeader(event, 'last-modified', lastModified)

  return buffer
})
