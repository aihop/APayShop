import { users, usersTokens } from "../../../db/schema"
import { count, desc, like, or, sql, eq, and } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { proxyExternalRequest } from '../../../utils/externalProxy'

interface LocalUserRow {
  id: number
  username: string
  email: string
  nickname: string | null
  createdAt: Date | string | null
  status: string | null
  lastLoginAt: Date | string | null
  cashBalance: number | string | null
  grantBalance: number | string | null
}

interface ActiveKeyRow {
  userId: number | string | null
  count: number | string
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = parseInt(query.pageSize as string) || 15
  const offset = (page - 1) * pageSize
  const keyword = String(query.q || query.keyword || '').trim()
  const hasSpending = String(query.hasSpending || '').trim()

  const likePattern = keyword ? `%${keyword.toLowerCase()}%` : ''

  const emailLower = sql`lower(${users.email})`
  const nicknameLower = sql`lower(coalesce(${users.nickname}, ''))`
  const idLower = sql`lower(cast(${users.id} as text))`

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
          pageSize: 10000, // 获取所有用户用于过滤和排序
        }
      })

      if (externalRes?.data?.list && Array.isArray(externalRes.data.list)) {
        externalRes.data.list.forEach((extUser: any) => {
          externalUsersMap.set(Number(extUser.id), extUser)
        })
      }
    } catch (externalError) {
      console.error('[admin/users] Failed to fetch external user data:', externalError)
      // 继续执行，但外部数据为空
    }

    // 获取本地所有匹配的用户
    let usersQuery = db.select({
      id: users.id,
      username: users.email,
      email: users.email,
      nickname: users.nickname,
      createdAt: users.createdAt,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      cashBalance: users.CashBalance,
      grantBalance: users.GrantBalance,
    }).from(users)

    if (keyword) {
      usersQuery = usersQuery.where(or(
        like(emailLower, likePattern),
        like(nicknameLower, likePattern),
        like(idLower, likePattern),
      )) as any
    }

    const allUsers = await usersQuery.orderBy(desc(users.createdAt)) as LocalUserRow[]

    // 合并本地用户与外部消费数据
    const mergedUsers = allUsers.map((user) => {
      const extData = externalUsersMap.get(user.id) || {}
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        cashBalance: Number(user.cashBalance || 0) / 1e8,
        grantBalance: Number(user.grantBalance || 0) / 1e8,
        availableBalance: (Number(user.cashBalance || 0) + Number(user.grantBalance || 0)) / 1e8,
        totalSpend: Number(extData.totalSpend || 0),
        totalRequests: Number(extData.totalRequests || 0),
        totalTokens: Number(extData.totalTokens || 0),
        promptTokens: Number(extData.promptTokens || 0),
        completionTokens: Number(extData.completionTokens || 0),
        lastRequestAt: extData.lastRequestAt || null,
      }
    })

    // 根据 hasSpending 过滤
    let filteredUsers = mergedUsers
    if (hasSpending === 'true') {
      filteredUsers = mergedUsers.filter(u => u.totalSpend > 0)
    } else if (hasSpending === 'false') {
      filteredUsers = mergedUsers.filter(u => u.totalSpend === 0)
    }

    const total = filteredUsers.length

    // 分页
    const paginatedUsers = filteredUsers.slice(offset, offset + pageSize)

    // 批量获取每个用户的活跃 token 数量
    const userIds = paginatedUsers.map(u => u.id)
    let activeKeyCountMap = new Map<number, number>()

    if (userIds.length > 0) {
      const activeKeysResult = await db
        .select({
          userId: usersTokens.userId,
          count: count(),
        })
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
        .groupBy(usersTokens.userId) as ActiveKeyRow[]

      activeKeysResult.forEach(row => {
        activeKeyCountMap.set(Number(row.userId), Number(row.count || 0))
      })
    }

    // 添加活跃 token 数量
    const finalUsers = paginatedUsers.map(user => ({
      ...user,
      activeKeyCount: activeKeyCountMap.get(user.id) || 0,
    }))

    return {
      data: {
        list: finalUsers,
        total,
        page,
        pageSize,
      }
    }
  } catch (error: any) {
    console.error('[admin/users] Error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || (locale === 'zh' ? '获取用户列表失败' : 'Failed to fetch users'),
    })
  }
})
