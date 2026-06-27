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
  const targetUrl = `${gatewayUrl}${path.startsWith('/') ? path : `/${path}`}`

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
