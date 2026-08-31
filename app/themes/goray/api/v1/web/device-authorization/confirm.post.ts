import { defineEventHandler, readBody } from 'h3'
import { requireApayWebUser } from '../../../../server/shared/coreAdapter'
import { confirmDeviceAuthorization } from '../../../../server/auth/deviceAuthService'
import { verifyCsrf } from '../../../../server/shared/csrf'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireApayWebUser(event)
    verifyCsrf(event)

    const body = await readBody(event)
    if (!body || !body.auth_id || typeof body.approved !== 'boolean') {
      throw Errors.badRequest('Missing auth_id or approved status')
    }

    await confirmDeviceAuthorization(body.auth_id, user.id, body.approved)
    return successResponse({ status: body.approved ? 'approved' : 'denied' }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
