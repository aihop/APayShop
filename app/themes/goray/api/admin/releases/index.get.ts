import { defineEventHandler } from 'h3'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)

    const releases = await goraySql<{
      id: string
      platform: string
      version: string
      build_number: number
      download_url: string
      sha256: string
      status: string
      released_at: Date
      created_at: Date
    }[]>`
      SELECT id, platform, version, build_number, download_url, sha256, status, released_at, created_at
      FROM goray_releases
      ORDER BY platform ASC, build_number DESC
    `

    return successResponse({ releases }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
