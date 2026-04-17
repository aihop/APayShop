import { admins } from "../../../db/schema"
import { desc,count } from "drizzle-orm"
import { db } from '@nuxthub/db'
 
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 12
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() }).from(admins)
  const total = totalResult[0]?.value || 0
  
  try {
    const result = await db.select({
      id:  admins.id,
      username: admins.username,
      createdAt: admins.createdAt
    })
    .from(admins)
    .orderBy(desc(admins.createdAt))
    .limit(pageSize)
    .offset(offset)
    
    return {
      data: result,
      total,
      page,
      pageSize
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch admins'
    })
  }
})
