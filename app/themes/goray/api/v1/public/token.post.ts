import { defineEventHandler, readBody, getHeader } from 'h3'
import { verifyDPoPProof } from '../../../server/crypto/dpop'
import { consumeDeviceAuthorization } from '../../../server/auth/deviceAuthService'
import { issueAccessToken, rotateRefreshToken } from '../../../server/auth/tokenService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const dpopHeader = getHeader(event, 'dpop')
    if (!dpopHeader) {
      throw Errors.dpopFailed('Missing DPoP header')
    }

    const { jkt } = verifyDPoPProof(dpopHeader, 'POST', '/api/goray/v1/public/token')

    const body = await readBody(event)
    if (!body || !body.grant_type) {
      throw Errors.badRequest('Missing grant_type')
    }

    if (body.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
      if (!body.device_code) {
        throw Errors.badRequest('Missing device_code')
      }
      const tokenResult = await consumeDeviceAuthorization(body.device_code, jkt)
      return successResponse(tokenResult, getRequestId(event))
    }

    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token || !body.device_id) {
        throw Errors.badRequest('Missing refresh_token or device_id')
      }

      const { rawToken: newRefreshToken } = await rotateRefreshToken(body.refresh_token, body.device_id)
      const newAccessToken = issueAccessToken(body.device_id, body.user_id || 1, jkt)

      return successResponse({
        access_token: newAccessToken,
        token_type: 'DPoP',
        expires_in: 900,
        refresh_token: newRefreshToken,
      }, getRequestId(event))
    }

    throw Errors.badRequest(`Unsupported grant_type: ${body.grant_type}`)
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
