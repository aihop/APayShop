import { defineEventHandler, getRouterParam } from 'h3'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)
    const deviceId = getRouterParam(event, 'id')
    if (!deviceId) throw Errors.badRequest('Missing device ID')

    await goraySql.begin(async (tx) => {
      await tx`
        UPDATE goray_devices
        SET status = 'revoked',
            data_key_id = NULL,
            encrypted_data_key = NULL,
            encrypted_data_key_nonce = NULL,
            revoked_at = NOW(),
            updated_at = NOW()
        WHERE id = ${deviceId}
      `

      await tx`
        UPDATE goray_refresh_tokens
        SET revoked_at = NOW()
        WHERE device_id = ${deviceId}
      `
    })

    return successResponse({ id: deviceId, status: 'revoked' }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
