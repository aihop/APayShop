import { logs } from "../../../db/schema"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    // Clear all logs
    await db.delete(logs)
    return { success: true, message: "All logs cleared successfully" }
  } catch (error) {
    throw createError({ statusCode: 500, message: "Failed to clear logs" })
  }
})