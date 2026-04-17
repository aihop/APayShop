import { failures } from "../../../db/schema"
import { desc } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {

  try {
    const data = await db.select()
      .from(failures)
      .orderBy(desc(failures.createdAt))
      
    return data
  } catch (error: any) {
    console.error('Fetch failures error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch failures'
    })
  }
})