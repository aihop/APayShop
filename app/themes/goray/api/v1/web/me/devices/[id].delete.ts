import { defineEventHandler, getRouterParam } from 'h3'
import { requireApayWebUser } from '../../../../../server/shared/coreAdapter'
import { verifyCsrf } from '../../../../../server/shared/csrf'
import { goraySql } from '../../../../../server/db/pg'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireApayWebUser(event)
    verifyCsrf(event)

    const deviceId = getRouterParam(event, 'id')
    if (!deviceId) {
      throw Errors.badRequest('Missing device ID')
    }

    await goraySql.begin(async (tx) => {
      // 撤销该设备并清空 DATA_KEY
      const result = await tx`
        UPDATE goray_devices
        SET status = 'revoked',
            data_key_id = NULL,
            encrypted_data_key = NULL,
            encrypted_data_key_nonce = NULL,
            revoked_at = NOW(),
            updated_at = NOW()
        WHERE id = ${deviceId} AND apay_user_id = ${user.id}
      `

      // 撤销 Refresh Tokens
      await tx`
        UPDATE goray_refresh_tokens
        SET revoked_at = NOW()
        WHERE device_id = ${deviceId}
      `
    })

    return successResponse({ status: 'revoked', device_id: deviceId }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
