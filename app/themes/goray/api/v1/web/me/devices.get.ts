import { defineEventHandler } from 'h3'
import { requireApayWebUser } from '../../../../server/shared/coreAdapter'
import { goraySql } from '../../../../server/db/pg'
import { getRequestId, handleApiError, successResponse } from '../../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireApayWebUser(event)

    const devices = await goraySql<{
      id: string
      name: string
      platform: string
      app_version: string
      status: string
      last_seen_at: Date | null
      created_at: Date
    }[]>`
      SELECT id, name, platform, app_version, status, last_seen_at, created_at
      FROM goray_devices
      WHERE apay_user_id = ${user.id}
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
    `

    return successResponse({ devices }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
