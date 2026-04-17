import { users } from "../../../db/schema"
import { count, desc } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize

  const totalResult = await db.select({ value: count() }).from(users)
  const total = totalResult[0]?.value || 0

  try {
    const result = await db.select({
      id: users.id,
      username: users.email,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
      status: users.status,
    })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset)

    return {
      data: result,
      total,
      page,
      pageSize,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch users',
    })
  }
})
