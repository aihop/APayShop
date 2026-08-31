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
  overrideQuery?: Record<string, string | number | boolean | null | undefined>
}

const tenantDepositPathPattern = /^\/api\/admin\/tenants\/([1-9]\d*)\/deposit$/
const tenantDepositLikePathPattern = /^\/api\/admin\/tenants\/[^/]+\/deposit$/
const tenantFundingPathPattern = /^\/api\/admin\/tenants\/([1-9]\d*)\/funding$/
const tenantFundingLikePathPattern = /^\/api\/admin\/tenants\/[^/]+\/funding$/
const tenantCollectionPath = '/api/admin/tenants'
const tenantDetailPathPattern = /^\/api\/admin\/tenants\/([1-9]\d*)$/
const tenantDetailLikePathPattern = /^\/api\/admin\/tenants\/[^/]+$/
const tenantRotateTokenPathPattern = /^\/api\/admin\/tenants\/([1-9]\d*)\/rotate-token$/
const tenantRotateTokenLikePathPattern = /^\/api\/admin\/tenants\/[^/]+\/rotate-token$/
const tenantAdminPathPattern = /^\/api\/admin\/tenants(?:\/|$)/
const tenantAmountFields = [
  'depositBalance',
  'scaledAmount',
  'topup',
  'grant',
  'openingBalance',
  'adminAdjust',
  'issued',
  'issuedFace',
  'shadowIssued',
  'derivedBalance',
  'id',
  'faceAmountCents',
  'chargedAmountCents',
  'beforeBalanceCents',
  'afterBalanceCents',
  'refTransactionId',
]
const tenantDepositTypes = new Set(['deposit_topup', 'deposit_grant', 'opening_balance', 'admin_adjust'])
const tenantFundingModes = new Set(['unlimited', 'shadow', 'prepaid'])
const tenantAmountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const tenantCodePattern = /^[a-z0-9][a-z0-9_-]{1,62}$/
const tenantBodyFields = new Set(['name', 'code', 'status', 'allowDirectLogin', 'keyGroupId'])
const tenantFundingBodyFields = new Set(['fundingMode', 'wholesaleRateBp', 'chargeGrant', 'chargePoints'])

const quoteIntegerFields = (raw: string, fields: string[]) => {
  let result = raw
  for (const field of fields) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(
      new RegExp(`("${escapedField}"\\s*:\\s*)(-?\\d+)(?=\\s*[,}])`, 'g'),
      '$1"$2"',
    )
  }
  return result
}

const assertTenantBodyFields = (input: Record<string, unknown>, allowedFields: Set<string>) => {
  if (Object.keys(input).some(field => !allowedFields.has(field))) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported tenant field' })
  }
}

const normalizeTenantFundingBody = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant funding body' })
  }
  const input = body as Record<string, unknown>
  assertTenantBodyFields(input, tenantFundingBodyFields)
  const fundingMode = typeof input.fundingMode === 'string' ? input.fundingMode.trim().toLowerCase() : ''
  if (!tenantFundingModes.has(fundingMode)) {
    throw createError({ statusCode: 400, statusMessage: 'fundingMode must be unlimited | shadow | prepaid' })
  }
  const wholesaleRateBp = Number(input.wholesaleRateBp ?? 10000)
  if (!Number.isInteger(wholesaleRateBp) || wholesaleRateBp <= 0 || wholesaleRateBp > 1000000) {
    throw createError({ statusCode: 400, statusMessage: 'wholesaleRateBp is out of range' })
  }
  return {
    fundingMode,
    wholesaleRateBp,
    chargeGrant: input.chargeGrant !== false,
    chargePoints: input.chargePoints !== false,
  }
}

const normalizeTenantFields = (body: unknown, includeStatus: boolean) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant body' })
  }

  const input = body as Record<string, unknown>
  const allowedFields = includeStatus
    ? tenantBodyFields
    : new Set(['name', 'code', 'allowDirectLogin', 'keyGroupId'])
  assertTenantBodyFields(input, allowedFields)

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const code = typeof input.code === 'string' ? input.code.trim().toLowerCase() : ''
  const allowDirectLogin = input.allowDirectLogin
  const keyGroupId = input.keyGroupId
  const status = input.status
  if (!name || name.length > 255 || !tenantCodePattern.test(code) || (!includeStatus && code === 'default')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant name or code' })
  }
  if (typeof allowDirectLogin !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid direct-login setting' })
  }
  if (!Number.isInteger(keyGroupId) || Number(keyGroupId) < 0 || Number(keyGroupId) > 2147483647) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key group ID' })
  }
  if (includeStatus && status !== 0 && status !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant status' })
  }

  return {
    name,
    code,
    ...(includeStatus ? { status } : {}),
    allowDirectLogin,
    keyGroupId,
  }
}

const buildTenantAdminBody = (method: string, targetPath: string, body: unknown) => {
  if (method === 'POST' && targetPath === tenantCollectionPath) {
    return normalizeTenantFields(body, false)
  }
  if (method === 'PUT' && tenantDetailPathPattern.test(targetPath)) {
    return normalizeTenantFields(body, true)
  }
  if (method === 'PUT' && tenantFundingPathPattern.test(targetPath)) {
    return normalizeTenantFundingBody(body)
  }
  if (method === 'PUT' && (tenantDetailLikePathPattern.test(targetPath) || tenantFundingLikePathPattern.test(targetPath))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant ID' })
  }
  if (method === 'POST' && tenantRotateTokenPathPattern.test(targetPath)) {
    return undefined
  }
  if (method === 'POST' && tenantRotateTokenLikePathPattern.test(targetPath)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant ID' })
  }
  if (method === 'POST') {
    return buildTenantDepositBody(targetPath, body)
  }
  return body
}

const buildTenantDepositBody = (targetPath: string, body: unknown) => {
  const match = tenantDepositPathPattern.exec(targetPath)
  if (!match) {
    if (tenantDepositLikePathPattern.test(targetPath)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid tenant ID' })
    }
    return body
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tenant deposit body' })
  }

  const input = body as Record<string, unknown>
  const amount = typeof input.amount === 'string' ? input.amount.trim() : ''
  const type = typeof input.type === 'string' ? input.type.trim().toLowerCase() : ''
  const remark = typeof input.remark === 'string' ? input.remark.trim() : ''
  const requestId = typeof input.requestId === 'string' ? input.requestId.trim().toLowerCase() : ''
  if (!tenantAmountPattern.test(amount) || !/[1-9]/.test(amount)) {
    throw createError({ statusCode: 400, statusMessage: 'Amount must be greater than 0 with at most 8 decimals' })
  }
  const [whole = '0', fraction = ''] = amount.split('.')
  const scaledAmount = BigInt(whole) * BigInt('100000000') + BigInt(fraction.padEnd(8, '0') || '0')
  if (scaledAmount > BigInt('9223372036854775807')) {
    throw createError({ statusCode: 400, statusMessage: 'Amount exceeds the supported AINode range' })
  }
  if (!tenantDepositTypes.has(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported deposit type' })
  }
  if (!remark || remark.length > 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Remark is required and must not exceed 1000 characters' })
  }
  if (!requestIdPattern.test(requestId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid deposit request ID' })
  }

  const eventId = `apay-tenant-deposit:${match[1]}:${requestId}`
  return `{"amount":${amount},"type":${JSON.stringify(type)},"direction":"credit","eventId":${JSON.stringify(eventId)},"remark":${JSON.stringify(remark)}}`
}

function normalizeGatewayUrl(raw: string | null | undefined) {
  const value = String(raw || '').trim()
  if (!value) {
    return ''
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`

  try {
    const url = new URL(withProtocol)
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

// 从 DB settings 读取 AI Gateway URL，带内存缓存
let cachedGatewayUrl: string | null = null
let lastGatewayUrlRead = 0
const SETTINGS_CACHE_TTL = 5000 // 5 秒

export async function getAIGatewayUrl(): Promise<string> {
  const now = Date.now()
  if (cachedGatewayUrl && now - lastGatewayUrlRead < SETTINGS_CACHE_TTL) {
    return cachedGatewayUrl
  }
  try {
    const result = await db.select().from(settings).where(eq(settings.key, 'ai_gateway_url')).limit(1)
    if (result.length > 0 && result[0].value) {
      const url = normalizeGatewayUrl(result[0].value)
      if (url) {
        cachedGatewayUrl = url
        lastGatewayUrlRead = now
        return url
      }
      console.warn('[Proxy] Ignore invalid ai_gateway_url setting:', result[0].value)
    }
  } catch (e) {
    console.error('[Proxy] Failed to read ai_gateway_url from settings:', e)
  }
  // Fallback: 只认环境变量，不再写仓库默认网关，避免污染部署配置。
  const fallback = normalizeGatewayUrl(process.env.AI_GATEWAY_URL)
  if (fallback) {
    cachedGatewayUrl = fallback
    lastGatewayUrlRead = now
    return fallback
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'AI gateway URL is not configured',
  })
}



// 从 DB settings 读取 integration_token，用于上游认证
let cachedToken: string | null = null
let lastTokenRead = 0

export async function getIntegrationToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken !== null && now - lastTokenRead < SETTINGS_CACHE_TTL) {
    return cachedToken
  }
  try {
    const result = await db.select().from(settings).where(eq(settings.key, 'integration_token')).limit(1)
    if (result.length > 0 && result[0].value) {
      cachedToken = result[0].value
      lastTokenRead = now
      return cachedToken
    }
  } catch (e) {
    console.error('[Proxy] Failed to read integration_token from settings:', e)
  }
  cachedToken = null
  lastTokenRead = now
  return null
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

export const getConfiguredGatewayOrigins = () => [
  normalizeGatewayUrl(cachedGatewayUrl || process.env.AI_GATEWAY_URL || ''),
].filter(Boolean)

// target= 模式在调用方未显式传 allowedOrigins/allowedPaths 时的默认白名单:
// 全仓唯一调用方 /api/proxy/external.ts 从不传这两个参数,此前 assertTargetAllowed
// 对空白名单直接放行,等于任意登录用户(甚至只带 x-auth cookie)都能让服务端携带
// integration token/NUXT_SESSION_PASSWORD 向任意 host 发请求(SSRF + 凭证泄露)。
// 实测全部真实调用方(useExternalApi 的 baseURL)只会是 AI 网关或 SAAS_API_URL,
// 这里收紧为只允许这两个受信来源,不影响任何现有用法。
async function getDefaultAllowedTargetOrigins(): Promise<string[]> {
  const origins = new Set<string>()
  try {
    origins.add(new URL(await getAIGatewayUrl()).origin)
  } catch {}
  const saasApiUrl = (process.env.SAAS_API_URL || '').trim()
  if (saasApiUrl) {
    try {
      origins.add(new URL(saasApiUrl).origin)
    } catch {}
  }
  return [...origins]
}

/**
 * Get the full webhook events URL for AI Gateway.
 */
export async function getWebhookSubscriptionUrl(): Promise<string> {
  const base = await getAIGatewayUrl()
  return `${base}/api/webhooks/events`
}

export async function proxyExternalRequest(event: H3Event, options: ProxyExternalRequestOptions = {}) {
  const {
    requireSession = true,
    allowedOrigins,
    allowedPaths,
    proxyLabel = 'Proxy',
    userAgent = 'APay-Proxy/1.0',
    overrideQuery,
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

  const query = overrideQuery ? { ...overrideQuery } : getQuery(event)

  // 支持两种传参方式：
  //   target=https://full.url/path  — 完整 URL（向后兼容）
  //   path=/api/relative/path       — 相对路径，服务端从 DB 读取 base URL
  let targetUrl: URL
  const rawTarget = query.target as string | undefined
  const rawPath = query.path as string | undefined

  if (rawPath) {
    // 相对路径模式：从 DB 读取 base URL，拼完整 URL。
    // SSRF 防线(同 gateway.ts):字符串拼接会被 `@host`、`//evil.com` 等构造改写目标
    // 主机,改用 URL 解析后强制校验 host/协议仍等于配置的网关,越界即拒。
    const baseUrl = await getAIGatewayUrl()
    try {
      const base = new URL(baseUrl)
      const resolved = new URL(rawPath.startsWith('/') ? rawPath : `/${rawPath}`, base)
      if (resolved.protocol !== base.protocol || resolved.host !== base.host) {
        throw new Error('cross-host')
      }
      targetUrl = resolved
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: invalid path parameter',
      })
    }
    // host 被钉死在网关不等于路径就可以随便挑:免登录的 public-external 正是走这个
    // 分支,它声明的 allowedPaths 此前从未生效,等于未认证请求就能借服务端的
    // integration_token 打网关上任意非 admin 接口。与 target= 分支共用同一套校验。
    assertTargetAllowed(targetUrl, allowedOrigins, allowedPaths)
  } else if (rawTarget) {
    targetUrl = normalizeTargetUrl(rawTarget)
    // 调用方未显式传白名单时不再无条件放行,回落到受信来源默认值(见上方说明)
    const effectiveAllowedOrigins = allowedOrigins ?? await getDefaultAllowedTargetOrigins()
    assertTargetAllowed(targetUrl, effectiveAllowedOrigins, allowedPaths)
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing target or path parameter',
    })
  }

  if ((targetUrl.pathname === '/api/admin' || targetUrl.pathname.startsWith('/api/admin/')) && !adminId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Admin access required for upstream admin APIs',
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
  body = buildTenantAdminBody(method, targetUrl.pathname, body)

  // 优先使用 integration_token，降级到系统 NUXT_SESSION_PASSWORD
  const integrationToken = await getIntegrationToken()
  const authToken = integrationToken || process.env.NUXT_SESSION_PASSWORD || ''

  const forwardHeaders: Record<string, string> = {
    Accept: (incomingHeaders.accept as string) || 'application/json',
    'Content-Type': (incomingHeaders['content-type'] as string) || 'application/json',
    'User-Agent': userAgent,
    Authorization: `Bearer ${authToken}`,
  }

  console.log(`[${proxyLabel} Debug] target=${targetUrl.toString()} auth=${authToken ? 'configured' : 'none'} (source: ${integrationToken ? 'integration_token' : 'NUXT_SESSION_PASSWORD'})`)

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
    signal: AbortSignal.timeout(60000), // 60s：Stats/Dashboard 等聚合接口需要较长查询时间
  }

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  try {
    const response = await fetch(targetUrl.toString(), fetchInit)
    const text = await response.text()

    if (!response.ok) {
      console.error(`[${proxyLabel} Error] ${response.status}`, targetUrl.toString(), text.slice(0, 500))
      // 透传上游错误体，让前端能看到 provider 的具体错误信息
      let upstreamError = text
      try {
        const parsed = JSON.parse(text)
        upstreamError = parsed.error?.message || parsed.msg || parsed.message || text
      } catch {}
      throw createError({
        statusCode: response.status,
        statusMessage: upstreamError.slice(0, 200),
      })
    }

    // Try JSON first, fall back to raw text
    try {
      const responseText = tenantAdminPathPattern.test(targetUrl.pathname)
        ? quoteIntegerFields(text, tenantAmountFields)
        : text
      return JSON.parse(responseText)
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
