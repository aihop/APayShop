import { createError, getCookie, getQuery, readBody } from 'h3'
import type { H3Event } from 'h3'
import { db } from '../db/runtime'
import { settings } from '../db/schema'
import { eq } from 'drizzle-orm'

interface ProxyExternalRequestOptions {
  requireSession?: boolean
  allowedOrigins?: Iterable<string>
  allowedPaths?: Iterable<string>
  proxyLabel?: string
  userAgent?: string
}

// 从 DB settings 读取 AI Gateway URL，带内存缓存
let cachedGatewayUrl: string | null = null
let lastGatewayUrlRead = 0
const GATEWAY_URL_CACHE_TTL = 5000 // 5 秒

async function getAIGatewayUrl(): Promise<string> {
  const now = Date.now()
  if (cachedGatewayUrl && now - lastGatewayUrlRead < GATEWAY_URL_CACHE_TTL) {
    return cachedGatewayUrl
  }
  try {
    const result = await db.select().from(settings).where(eq(settings.key, 'ai_gateway_url')).limit(1)
    if (result.length > 0 && result[0].value) {
      cachedGatewayUrl = result[0].value.replace(/\/+$/, '')
      lastGatewayUrlRead = now
      return cachedGatewayUrl
    }
  } catch (e) {
    console.error('[Proxy] Failed to read ai_gateway_url from settings:', e)
  }
  // Fallback: 环境变量 → 硬编码默认值
  const fallback = (process.env.AI_GATEWAY_URL || 'https://api.ainode.run').replace(/\/+$/, '')
  cachedGatewayUrl = fallback
  lastGatewayUrlRead = now
  return fallback
}

const normalizeTargetUrl = (targetUrl: string) => {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing or invalid target URL',
    })
  }

  try {
    return new URL(targetUrl)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing or invalid target URL',
    })
  }
}

const assertTargetAllowed = (targetUrl: URL, allowedOrigins?: Iterable<string>, allowedPaths?: Iterable<string>) => {
  if (!allowedOrigins && !allowedPaths) {
    return
  }

  const normalizedOrigins = allowedOrigins ? new Set([...allowedOrigins].map((item) => item.replace(/\/+$/, ''))) : null
  const normalizedPaths = allowedPaths ? new Set(allowedPaths) : null

  if ((normalizedOrigins && !normalizedOrigins.has(targetUrl.origin)) || (normalizedPaths && !normalizedPaths.has(targetUrl.pathname))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Target is not allowed for this proxy',
    })
  }
}

export const getConfiguredGatewayOrigins = () => [(cachedGatewayUrl || process.env.AI_GATEWAY_URL || 'https://api.ainode.run').replace(/\/+$/, '')]

export async function proxyExternalRequest(event: H3Event, options: ProxyExternalRequestOptions = {}) {
  const {
    requireSession = true,
    allowedOrigins,
    allowedPaths,
    proxyLabel = 'Proxy',
    userAgent = 'APayShop-Proxy/1.0',
  } = options
  const session = await getUserSession(event).catch(() => null)
  const userId = (session?.user as any)?.id
  const adminId = (session?.admin as any)?.id
  const adminUsername = (session?.admin as any)?.username
  const incomingHeaders = event.node.req.headers
  const xAuth = (incomingHeaders['x-auth'] as string) || getCookie(event, 'x-auth')

  if (requireSession && !userId && !adminId && !xAuth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Session not found',
    })
  }

  const query = getQuery(event)

  // 支持两种传参方式：
  //   target=https://full.url/path  — 完整 URL（向后兼容）
  //   path=/api/relative/path       — 相对路径，服务端从 DB 读取 base URL
  let targetUrl: URL
  const rawTarget = query.target as string | undefined
  const rawPath = query.path as string | undefined

  if (rawPath) {
    // 相对路径模式：从 DB 读取 base URL，拼完整 URL
    const baseUrl = await getAIGatewayUrl()
    targetUrl = new URL(baseUrl + rawPath)
  } else if (rawTarget) {
    targetUrl = normalizeTargetUrl(rawTarget)
    assertTargetAllowed(targetUrl, allowedOrigins, allowedPaths)
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing target or path parameter',
    })
  }

  const forwardQuery = { ...query }
  delete forwardQuery.target
  delete forwardQuery.path

  const method = (event.node.req.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  let body: any

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await readBody(event).catch(() => undefined)
  }

  const forwardHeaders: Record<string, string> = {
    Accept: (incomingHeaders.accept as string) || 'application/json',
    'Content-Type': (incomingHeaders['content-type'] as string) || 'application/json',
    'User-Agent': userAgent,
    Authorization: `Bearer ${process.env.NUXT_SESSION_PASSWORD}`,
  }

  console.log(`[${proxyLabel} Debug] target=${targetUrl.toString()} auth=Bearer ${process.env.NUXT_SESSION_PASSWORD ? 'set(' + process.env.NUXT_SESSION_PASSWORD.slice(0, 8) + '...)' : 'EMPTY!'}`)

  if (userId) {
    forwardHeaders['X-Internal-User-Id'] = String(userId)
  }

  if (adminId) {
    forwardHeaders['X-Internal-Admin-Id'] = String(adminId)
  }

  if (adminUsername) {
    forwardHeaders['X-Internal-Admin-Username'] = String(adminUsername)
  }

  if (xAuth) {
    forwardHeaders['X-Auth'] = xAuth
  }

  // Append forwardQuery params to the URL (native fetch doesn't have a `query` option like ofetch)
  const keys = Object.keys(forwardQuery)
  if (keys.length > 0) {
    keys.forEach((key) => {
      targetUrl.searchParams.set(key, String(forwardQuery[key]))
    })
  }

  const fetchInit: RequestInit = {
    method,
    headers: forwardHeaders,
    signal: AbortSignal.timeout(15000),
  }

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  try {
    const response = await fetch(targetUrl.toString(), fetchInit)
    const text = await response.text()

    if (!response.ok) {
      console.error(`[${proxyLabel} Error] ${response.status}`, targetUrl.toString(), text.slice(0, 500))
      throw createError({
        statusCode: 502,
        statusMessage: `Bad Gateway: upstream responded ${response.status}`,
      })
    }

    // Try JSON first, fall back to raw text
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (error: any) {
    // Re-throw h3 errors as-is
    if (error.statusCode) {
      throw error
    }
    const causeStr = error.cause ? `[cause: ${error.cause.message || JSON.stringify(error.cause)}] ` : ''
    console.error(`[${proxyLabel} Error]`, targetUrl.toString(), causeStr + (error.message || error))
    throw createError({
      statusCode: 502,
      statusMessage: `Bad Gateway: Failed to reach external service. ${causeStr}${error.message}`,
    })
  }
}
