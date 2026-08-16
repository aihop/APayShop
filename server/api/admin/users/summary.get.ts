import { users, usersTokens } from "../../../db/schema"
import { count, like, or, sql, eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { proxyExternalRequest } from '../../../utils/externalProxy'

interface LocalUserSummaryRow {
  id: number
  email: string
  nickname: string | null
  cashBalance: number | string | null
  grantBalance: number | string | null
  status: string | null
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const keyword = String(query.q || query.keyword || '').trim()
  const hasSpending = String(query.hasSpending || '').trim()

  try {
    // 获取外部 API 的用户消费数据
    let externalUsersMap = new Map<number, any>()

    try {
      const externalRes = await proxyExternalRequest(event, {
        requireSession: true,
        proxyLabel: 'ExternalUsersAPI',
        userAgent: 'APay-Admin/1.0',
        overrideQuery: {
          path: '/api/admin/users',
          page: 1,
          pageSize: 10000, // 获取所有用户的消费数据用于汇总
        }
      })

      if (externalRes?.data?.list && Array.isArray(externalRes.data.list)) {
        externalRes.data.list.forEach((extUser: any) => {
          externalUsersMap.set(Number(extUser.id), extUser)
        })
      }
    } catch (externalError) {
      console.error('[admin/users/summary] Failed to fetch external user data:', externalError)
      // 继续执行，但外部数据为空
    }

    // 构建搜索条件
    const likePattern = keyword ? `%${keyword.toLowerCase()}%` : ''
    const emailLower = sql`lower(${users.email})`
    const nicknameLower = sql`lower(coalesce(${users.nickname}, ''))`
    const idLower = sql`lower(cast(${users.id} as text))`

    // 获取本地所有用户
    let usersQuery = db.select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      cashBalance: users.CashBalance,
      grantBalance: users.GrantBalance,
      status: users.status,
    }).from(users)

    if (keyword) {
      usersQuery = usersQuery.where(or(
        like(emailLower, likePattern),
        like(nicknameLower, likePattern),
        like(idLower, likePattern),
      )) as any
    }

    const allUsers = await usersQuery as LocalUserSummaryRow[]

    // 合并本地用户与外部消费数据
    const mergedUsers = allUsers.map((user) => {
      const extData = externalUsersMap.get(user.id) || {}
      return {
        ...user,
        totalSpend: Number(extData.totalSpend || 0),
        totalRequests: Number(extData.totalRequests || 0),
        totalTokens: Number(extData.totalTokens || 0),
        promptTokens: Number(extData.promptTokens || 0),
        completionTokens: Number(extData.completionTokens || 0),
      }
    })

    // 根据 hasSpending 过滤
    let filteredUsers = mergedUsers
    if (hasSpending === 'true') {
      filteredUsers = mergedUsers.filter(u => u.totalSpend > 0)
    } else if (hasSpending === 'false') {
      filteredUsers = mergedUsers.filter(u => u.totalSpend === 0)
    }

    // 统计活跃用户（有消费记录或有余额的用户）
    const activeUsers = filteredUsers.filter(u =>
      u.totalSpend > 0 ||
      Number(u.cashBalance || 0) > 0 ||
      Number(u.grantBalance || 0) > 0
    ).length

    // 计算汇总数据
    const summary = {
      totalUsers: filteredUsers.length,
      activeUsers: activeUsers,
      totalCashBalance: filteredUsers.reduce((sum, u) => sum + Number(u.cashBalance || 0), 0) / 1e8,
      totalGrantBalance: filteredUsers.reduce((sum, u) => sum + Number(u.grantBalance || 0), 0) / 1e8,
      totalBalance: filteredUsers.reduce((sum, u) =>
        sum + Number(u.cashBalance || 0) + Number(u.grantBalance || 0), 0) / 1e8,
      totalRequests: filteredUsers.reduce((sum, u) => sum + u.totalRequests, 0),
      totalTokens: filteredUsers.reduce((sum, u) => sum + u.totalTokens, 0),
      totalActiveKeys: 0, // Will be calculated below
    }

    // 统计活跃 token 数量
    if (filteredUsers.length > 0) {
      const userIds = filteredUsers.map(u => u.id)
      const activeKeysResult = await db
        .select({ count: count() })
        .from(usersTokens)
        .where(
          and(
            sql`${usersTokens.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
            eq(usersTokens.revoked, false),
            or(
              sql`${usersTokens.expiresAt} IS NULL`,
              sql`${usersTokens.expiresAt} > NOW()`
            )
          )
        )

      summary.totalActiveKeys = Number(activeKeysResult[0]?.count || 0)
    }

    return {
      data: summary,
    }
  } catch (error: any) {
    console.error('[admin/users/summary] Error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取用户汇总失败' : 'Failed to fetch user summary'),
    })
  }
})
