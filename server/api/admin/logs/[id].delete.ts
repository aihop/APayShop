import { logs } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing log ID" })
  }

  try {
    await db.delete(logs).where(eq(logs.id, parseInt(id)))
    return { success: true }
  } catch (error) {
    throw createError({ statusCode: 500, message: "Failed to delete log" })
  }
})