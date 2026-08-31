import { H3Event, createError } from 'h3'
import { randomUUID } from 'node:crypto'

export interface ApiResponse<T = any> {
  code: number
  message: string
  request_id: string
  server_time: number
  data: T
}

export class GorayError extends Error {
  public status: number
  public code: number

  constructor(status: number, code: number, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'GorayError'
  }
}

export const Errors = {
  badRequest: (msg = 'Bad Request', code = 40000) => new GorayError(400, code, msg),
  unauthorized: (msg = 'Unauthorized', code = 40100) => new GorayError(401, code, msg),
  dpopFailed: (msg = 'DPoP Proof Verification Failed', code = 40101) => new GorayError(401, code, msg),
  tokenExpired: (msg = 'Token Expired', code = 40102) => new GorayError(401, code, msg),
  deviceNotFound: (msg = 'Device Not Found or Revoked', code = 40103) => new GorayError(401, code, msg),
  forbidden: (msg = 'Forbidden', code = 40300) => new GorayError(403, code, msg),
  entitlementRequired: (msg = 'Active Subscription Required', code = 40301) => new GorayError(403, code, msg),
  deviceLimitExceeded: (msg = 'Device Limit Exceeded', code = 40302) => new GorayError(403, code, msg),
  trafficExhausted: (msg = 'Traffic Quota Exhausted', code = 40303) => new GorayError(403, code, msg),
  notFound: (msg = 'Not Found', code = 40400) => new GorayError(404, code, msg),
  conflict: (msg = 'Conflict / Idempotency Conflict', code = 40900) => new GorayError(409, code, msg),
  tooManyRequests: (msg = 'Too Many Requests', code = 42900) => new GorayError(429, code, msg),
  internal: (msg = 'Internal Server Error', code = 50000) => new GorayError(500, code, msg),
}

export const getRequestId = (event: H3Event): string => {
  const reqId = (event.node.req.headers['x-goray-request-id'] || event.node.req.headers['x-request-id']) as string
  return reqId || randomUUID()
}

export const successResponse = <T>(data: T, requestId?: string): ApiResponse<T> => {
  return {
    code: 0,
    message: 'ok',
    request_id: requestId || randomUUID(),
    server_time: Math.floor(Date.now() / 1000),
    data,
  }
}

export const handleApiError = (event: H3Event, err: any): never => {
  const requestId = getRequestId(event)
  const serverTime = Math.floor(Date.now() / 1000)

  let status = 500
  let code = 50000
  let message = 'Internal Server Error'

  if (err instanceof GorayError) {
    status = err.status
    code = err.code
    message = err.message
  } else if (err?.statusCode || err?.status) {
    status = err.statusCode || err.status
    code = status * 100
    message = err.message || 'Error'
  } else if (err?.message) {
    message = err.message
  }

  // 生产环境脱敏 500 错误
  if (status >= 500 && process.env.NODE_ENV === 'production') {
    console.error(`[goray-error] ${requestId}:`, err)
    message = 'Internal Server Error'
  }

  throw createError({
    statusCode: status,
    statusMessage: message,
    data: {
      code,
      message,
      request_id: requestId,
      server_time: serverTime,
      data: null,
    },
  })
}
