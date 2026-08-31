import { defineEventHandler } from 'h3'
import { assertGoraySchemaReady } from '../server/db/pg'
import { handleApiError, successResponse } from '../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await assertGoraySchemaReady()
    return successResponse({ status: 'ready', database: 'connected' })
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
