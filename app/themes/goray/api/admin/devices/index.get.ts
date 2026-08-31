import { defineEventHandler } from 'h3'
import { requireApayAdmin, getApayUserBriefs } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)

    const devices = await goraySql<{
      id: string
      apay_user_id: number
      name: string
      platform: string
      app_version: string
      proof_key_jkt: string
      status: string
      last_seen_at: Date | null
      created_at: Date
    }[]>`
      SELECT id, apay_user_id, name, platform, app_version, proof_key_jkt, status, last_seen_at, created_at
      FROM goray_devices
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
      LIMIT 100
    `

    const userIds = [...new Set(devices.map((d) => Number(d.apay_user_id)))]
    const userBriefs = await getApayUserBriefs(userIds)

    const result = devices.map((d) => ({
      ...d,
      user_email: userBriefs.get(Number(d.apay_user_id))?.email || `User #${d.apay_user_id}`,
    }))

    return successResponse({ devices: result }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
