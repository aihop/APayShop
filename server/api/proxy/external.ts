import { defineEventHandler, getQuery, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session.user as any)?.id
  const adminId = (session.admin as any)?.id

  if (!userId && !adminId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Session not found'
    })
  }

  const query = getQuery(event)
  const targetUrl = query.target as string

  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing or invalid target URL'
    })
  }

  const forwardQuery = { ...query }
  delete forwardQuery.target

  const method = (event.node.req.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  let body: any = undefined

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      body = await readBody(event)
    } catch {
    }
  }

  const incomingHeaders = event.node.req.headers
  const forwardHeaders: Record<string, string> = {
    'Accept': incomingHeaders.accept || 'application/json',
    'Content-Type': incomingHeaders['content-type'] || 'application/json',
    'User-Agent': 'APayShop-Proxy/1.0',
    'Authorization': `Bearer ${process.env.AI_GATEWAY_SECRET_TOKEN || 'admin-secret-key'}`,
  }

  if (userId) {
    forwardHeaders['X-Internal-User-Id'] = String(userId)
  }

  if (adminId) {
    forwardHeaders['X-Internal-Admin-Id'] = String(adminId)
  }

  try {
    const response = await $fetch(targetUrl, {
      method,
      query: forwardQuery,
      body,
      headers: forwardHeaders,
      ignoreResponseError: true 
    })

    return response
  } catch (error: any) {
    console.error('[Proxy Error]', targetUrl, error)
    throw createError({
      statusCode: 502,
      statusMessage: `Bad Gateway: Failed to reach external service. ${error.message}`
    })
  }
})
