import { createError, getCookie, getQuery, readBody } from 'h3'
import type { H3Event } from 'h3'

interface ProxyExternalRequestOptions {
  requireSession?: boolean
  allowedOrigins?: Iterable<string>
  allowedPaths?: Iterable<string>
  proxyLabel?: string
  userAgent?: string
}

const getAllowedGatewayOrigins = () => {
  return [
    process.env.AI_GATEWAY_URL,
    process.env.SAAS_API_URL,
  ]
    .filter(Boolean)
    .map((value) => String(value).replace(/\/+$/, ''))
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

export const getConfiguredGatewayOrigins = getAllowedGatewayOrigins

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
  const incomingHeaders = event.node.req.headers
  const xAuth = (incomingHeaders['x-auth'] as string) || getCookie(event, 'x-auth')

  if (requireSession && !userId && !adminId && !xAuth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Session not found',
    })
  }

  const query = getQuery(event)
  const targetUrl = normalizeTargetUrl(query.target as string)
  assertTargetAllowed(targetUrl, allowedOrigins, allowedPaths)

  const forwardQuery = { ...query }
  delete forwardQuery.target

  const method = (event.node.req.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  let body: any

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await readBody(event).catch(() => undefined)
  }

  const forwardHeaders: Record<string, string> = {
    Accept: (incomingHeaders.accept as string) || 'application/json',
    'Content-Type': (incomingHeaders['content-type'] as string) || 'application/json',
    'User-Agent': userAgent,
    Authorization: `Bearer ${process.env.AI_GATEWAY_SECRET_TOKEN || 'admin-secret-key'}`,
  }

  if (userId) {
    forwardHeaders['X-Internal-User-Id'] = String(userId)
  }

  if (adminId) {
    forwardHeaders['X-Internal-Admin-Id'] = String(adminId)
  }

  if (xAuth) {
    forwardHeaders['X-Auth'] = xAuth
  }

  try {
    return await $fetch(targetUrl.toString(), {
      method,
      query: forwardQuery,
      body,
      headers: forwardHeaders,
      ignoreResponseError: true,
    })
  } catch (error: any) {
    console.error(`[${proxyLabel} Error]`, targetUrl.toString(), error)
    throw createError({
      statusCode: 502,
      statusMessage: `Bad Gateway: Failed to reach external service. ${error.message}`,
    })
  }
}
