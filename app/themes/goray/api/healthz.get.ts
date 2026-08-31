import { defineEventHandler } from 'h3'
import { successResponse } from '../server/shared/errors'

export default defineEventHandler((event) => {
  return successResponse({ status: 'ok', time: new Date().toISOString() })
})
