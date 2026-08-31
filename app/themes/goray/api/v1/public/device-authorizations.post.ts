import { defineEventHandler, readBody, getHeader } from 'h3'
import { initiateDeviceAuthorization } from '../../../server/auth/deviceAuthService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'
import { checkRateLimit } from '../../../server/redis/client'

export default defineEventHandler(async (event) => {
  try {
    const ip = getHeader(event, 'x-forwarded-for') || getHeader(event, 'cf-connecting-ip') || '127.0.0.1'
    const rate = await checkRateLimit(`device_auth:${ip}`, 30, 60)
    if (!rate.allowed) {
      throw Errors.tooManyRequests()
    }

    const body = await readBody(event)
    if (!body || !body.device_name || !body.platform || !body.app_version || !body.encryption_public_key_spki || !body.proof_public_jwk) {
      throw Errors.badRequest('Missing required fields for device authorization')
    }

    const host = getHeader(event, 'host') || 'goray.org'
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
    const origin = `${protocol}://${host}`

    const result = await initiateDeviceAuthorization(body, origin)
    return successResponse(result, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
