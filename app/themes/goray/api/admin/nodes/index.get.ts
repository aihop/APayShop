import { defineEventHandler } from 'h3'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)

    const nodes = await goraySql<{
      id: string
      display_name: string
      country_code: string
      region: string | null
      protocol: string
      weight: number
      display_order: number
      status: string
      health_status: string
      last_checked_at: Date | null
      created_at: Date
      updated_at: Date
    }[]>`
      SELECT 
        id, display_name, country_code, region, protocol,
        weight, display_order, status, health_status, last_checked_at,
        created_at, updated_at
      FROM goray_nodes
      ORDER BY display_order ASC, weight DESC, created_at ASC
    `

    return successResponse({ nodes }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
