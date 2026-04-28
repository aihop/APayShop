import { logs } from "../../../db/schema"
import { db } from '../../../db/runtime'

export default defineEventHandler(async (event) => {
  try {
    // Clear all logs
    await db.delete(logs)
    return { success: true, message: "All logs cleared successfully" }
  } catch (error) {
    throw createError({ statusCode: 500, message: "Failed to clear logs" })
  }
})