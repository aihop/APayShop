import { defineEventHandler, getQuery } from 'h3'
import { requireApayWebUser } from '../../../../server/shared/coreAdapter'
import { lookupDeviceAuthByUserCode } from '../../../../server/auth/deviceAuthService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../../server/shared/errors'
import { issueCsrfToken } from '../../../../server/shared/csrf'

export default defineEventHandler(async (event) => {
  try {
    await requireApayWebUser(event)
    issueCsrfToken(event)

    const query = getQuery(event)
    const code = (query.code as string || '').trim()

    if (!code) {
      throw Errors.badRequest('Missing user code')
    }

    const authInfo = await lookupDeviceAuthByUserCode(code)
    return successResponse(authInfo, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
