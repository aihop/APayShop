import { defineEventHandler, readBody, getHeader } from 'h3'
import { verifyDPoPProof } from '../../server/crypto/dpop'
import { verifyAccessToken } from '../../server/auth/tokenService'
import { processTrafficReport } from '../../server/traffic/trafficService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    const dpopHeader = getHeader(event, 'dpop')
    const timestampHeader = getHeader(event, 'x-goray-timestamp')

    if (!authHeader || !authHeader.startsWith('DPoP ')) {
      throw Errors.unauthorized('Missing DPoP Authorization header')
    }
    if (!dpopHeader) {
      throw Errors.dpopFailed('Missing DPoP header')
    }

    const token = authHeader.replace(/^DPoP\s+/i, '').trim()
    const { jkt } = verifyDPoPProof(dpopHeader, 'POST', '/api/goray/v1/traffic', undefined, token)
    const claims = verifyAccessToken(token, jkt)

    const clientTime = timestampHeader ? Number(timestampHeader) : Math.floor(Date.now() / 1000)
    const requestId = getRequestId(event)

    const body = await readBody(event)
    if (!body || !body.key_id || !body.nonce || !body.ciphertext) {
      throw Errors.badRequest('Missing encrypted envelope fields')
    }

    const result = await processTrafficReport(claims.sub, claims.uid, requestId, clientTime, body)
    return successResponse(result, requestId)
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
