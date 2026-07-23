import { defineEventHandler, getQuery, readBody, createError } from 'h3'
import { getAIGatewayUrl } from '../../utils/externalProxy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path parameter' })
  }

  const apiKey = event.node.req.headers['x-api-key'] as string
  if (!apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'Missing API key (x-api-key header)' })
  }

  const gatewayUrl = await getAIGatewayUrl()

  // SSRF 防线:path 是客户端传入的,直接字符串拼接会被 `@host`、`//evil.com`、
  // `../` 等构造改写目标主机。用 URL 解析后强制校验 host/协议仍等于配置的
  // 网关,越界即拒——攻击者只能访问网关自身的路径,不能借此打别的主机。
  let targetUrl: string
  try {
    const base = new URL(gatewayUrl)
    const resolved = new URL(path.startsWith('/') ? path : `/${path}`, base)
    if (resolved.protocol !== base.protocol || resolved.host !== base.host) {
      throw new Error('cross-host')
    }
    targetUrl = resolved.toString()
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path parameter' })
  }

  const method = event.node.req.method || 'POST'

  let body: any
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await readBody(event).catch(() => undefined)
  }

  const response = await fetch(targetUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })

  const text = await response.text()

  if (!response.ok) {
    let errorDetail = text.slice(0, 300)
    try {
      const parsed = JSON.parse(errorDetail)
      errorDetail = parsed.error?.message || parsed.message || errorDetail
    } catch {}
    throw createError({
      statusCode: 502,
      statusMessage: `Gateway upstream error: ${errorDetail}`,
    })
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
})
