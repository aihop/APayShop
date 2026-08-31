import { defineEventHandler, getHeader } from 'h3'
import { verifyDPoPProof } from '../../server/crypto/dpop'
import { verifyAccessToken } from '../../server/auth/tokenService'
import { getEffectiveEntitlement } from '../../server/entitlements/service'
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
    const { jkt } = verifyDPoPProof(dpopHeader, 'GET', '/api/goray/v1/profile', undefined, token)
    const claims = verifyAccessToken(token, jkt)

    const entitlementResult = await getEffectiveEntitlement(claims.uid)

    const profileData = {
      user_id: claims.uid,
      device_id: claims.sub,
      plan_code: entitlementResult.entitlement?.plan_code || 'none',
      plan_level: entitlementResult.entitlement?.plan_level || 0,
      is_active: entitlementResult.isUsable,
      need_disconnect: entitlementResult.needDisconnect,
      device_limit: entitlementResult.deviceLimit,
      active_devices_count: entitlementResult.activeDevicesCount,
      traffic_limit_bytes: entitlementResult.entitlement?.traffic_limit_bytes ? Number(entitlementResult.entitlement.traffic_limit_bytes) : 0,
      used_traffic_bytes: entitlementResult.entitlement?.used_traffic_bytes ? Number(entitlementResult.entitlement.used_traffic_bytes) : 0,
      remaining_traffic_bytes: entitlementResult.remainingTrafficBytes,
      expires_at: entitlementResult.entitlement?.expires_at || null,
    }

    return successResponse(profileData, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
