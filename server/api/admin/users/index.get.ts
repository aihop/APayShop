import { users } from "../../../db/schema"
import { count, desc, like, or, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize
  const keyword = String(query.q || query.keyword || '').trim()

  const likePattern = keyword ? `%${keyword.toLowerCase()}%` : ''

  const emailLower = sql`lower(${users.email})`
  const nicknameLower = sql`lower(coalesce(${users.nickname}, ''))`
  const idLower = sql`lower(cast(${users.id} as text))`

  const totalBase = db.select({ value: count() }).from(users)
  const totalResult = keyword
    ? await totalBase.where(or(
        like(emailLower, likePattern),
        like(nicknameLower, likePattern),
        like(idLower, likePattern),
      ))
    : await totalBase
  const total = totalResult[0]?.value || 0

  try {
    let baseQuery = db.select({
      id: users.id,
      username: users.email,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
      status: users.status,
    })
      .from(users)

    if (keyword) {
      baseQuery = baseQuery.where(or(
        like(emailLower, likePattern),
        like(nicknameLower, likePattern),
        like(idLower, likePattern),
      )) as any
    }

    const result = await baseQuery
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
      message: error.message || (locale === 'zh' ? '获取用户列表失败' : 'Failed to fetch users'),
    })
  }
})
