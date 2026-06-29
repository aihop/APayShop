import { defineEventHandler, getQuery, readBody, setResponseHeader, setResponseStatus } from 'h3'
import { getAIGatewayUrl } from '../../../utils/externalProxy'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const { apiKey, model, messages } = body || {}

  if (!apiKey || !model || !messages) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: missing apiKey, model, or messages',
    })
  }

  const baseUrl = await getAIGatewayUrl()
  const targetUrl = `${baseUrl}/v1/chat/completions`

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: AbortSignal.timeout(120000),
  })

  if (!upstream.ok) {
    let errMsg = `HTTP ${upstream.status}`
    try {
      const errBody = await upstream.json()
      errMsg = errBody?.error?.message || errBody?.message || errMsg
    } catch {}
    throw createError({ statusCode: upstream.status, statusMessage: errMsg })
  }

  // Forward the streaming SSE response back to the browser
  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream') && upstream.body) {
    setResponseHeader(event, 'content-type', 'text/event-stream')
    setResponseHeader(event, 'cache-control', 'no-cache')
    setResponseHeader(event, 'x-accel-buffering', 'no')
    setResponseHeader(event, 'connection', 'keep-alive')

    // Return the upstream body as a ReadableStream
    return upstream.body as ReadableStream
  }

  // Non-streaming fallback
  const data = await upstream.json()
  return data
})
