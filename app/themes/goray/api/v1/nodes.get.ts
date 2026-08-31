import { defineEventHandler, getHeader } from 'h3'
import { verifyDPoPProof } from '../../server/crypto/dpop'
import { verifyAccessToken } from '../../server/auth/tokenService'
import { getEffectiveEntitlement } from '../../server/entitlements/service'
import { getEncryptedNodesForDevice } from '../../server/nodes/nodeService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    const dpopHeader = getHeader(event, 'dpop')

    if (!authHeader || !authHeader.startsWith('DPoP ')) {
      throw Errors.unauthorized('Missing DPoP Authorization header')
    }
    if (!dpopHeader) {
      throw Errors.dpopFailed('Missing DPoP header')
    }

    const token = authHeader.replace(/^DPoP\s+/i, '').trim()
    const { jkt } = verifyDPoPProof(dpopHeader, 'GET', '/api/goray/v1/nodes', undefined, token)
    const claims = verifyAccessToken(token, jkt)

    // 校验权益有效性
    const entitlementResult = await getEffectiveEntitlement(claims.uid)
    if (!entitlementResult.isUsable || !entitlementResult.entitlement) {
      if (entitlementResult.entitlement) {
        throw Errors.trafficExhausted()
      }
      throw Errors.entitlementRequired()
    }

    const requestId = getRequestId(event)
    const envelope = await getEncryptedNodesForDevice(claims.sub, claims.uid, requestId)

    return successResponse(envelope, requestId)
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
