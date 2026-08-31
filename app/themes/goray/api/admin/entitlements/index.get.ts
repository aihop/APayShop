import { defineEventHandler } from 'h3'
import { requireApayAdmin, getApayUserBriefs } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)

    const entitlements = await goraySql<{
      id: string
      apay_user_id: number
      source_type: string
      source_id: string
      plan_code: string
      plan_level: number
      device_limit: number
      traffic_limit_bytes: number
      used_traffic_bytes: number
      starts_at: Date
      expires_at: Date
      status: string
      created_at: Date
    }[]>`
      SELECT 
        id, apay_user_id, source_type, source_id, plan_code, plan_level,
        device_limit, traffic_limit_bytes, used_traffic_bytes,
        starts_at, expires_at, status, created_at
      FROM goray_entitlements
      ORDER BY created_at DESC
      LIMIT 100
    `

    const userIds = [...new Set(entitlements.map((e) => Number(e.apay_user_id)))]
    const userBriefs = await getApayUserBriefs(userIds)

    const result = entitlements.map((e) => ({
      ...e,
      user_email: userBriefs.get(Number(e.apay_user_id))?.email || `User #${e.apay_user_id}`,
    }))

    return successResponse({ entitlements: result }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
