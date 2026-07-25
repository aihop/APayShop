import { users, orders, products, subscriptions, oauthAccounts, usersTokens, visitorProfiles, promoMembers } from "../../../db/schema"
import { eq, desc } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '用户 ID 不能为空' : 'User ID is required' })
  }
  const userId = Number(id)

  try {
    const userRows = await db.select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      emailVerifiedAt: users.emailVerifiedAt,
      cashBalance: users.CashBalance,
      grantBalance: users.GrantBalance,
      subBalance: users.SubBalance,
      tierLevel: users.TierLevel,
      subExpiresAt: users.SubExpiresAt,
    }).from(users).where(eq(users.id, userId)).limit(1)

    const user = userRows[0]
    if (!user) {
      throw createError({ statusCode: 404, message: locale === 'zh' ? '用户不存在' : 'User not found' })
    }

    // Scaled by 1e8 in storage — see server/utils/topup.ts.
    const BALANCE_SCALE = 100000000
    const toDisplayBalance = (v: unknown) => Number(v || 0) / BALANCE_SCALE

    const [orderRows, subscriptionRows, oauthRows, tokenRows, profileRows, promoRows] = await Promise.all([
      db.select({
        id: orders.id,
        amount: orders.amount,
        currency: orders.currency,
        status: orders.status,
        payStatus: orders.payStatus,
        payMethod: orders.payMethod,
        contactEmail: orders.contactEmail,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        productImage: products.imageUrl,
      })
        .from(orders)
        .leftJoin(products, eq(orders.productId, products.id))
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt)),

      db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        interval: subscriptions.interval,
        intervalCount: subscriptions.intervalCount,
        amount: subscriptions.amount,
        currency: subscriptions.currency,
        payMethod: subscriptions.payMethod,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        productId: products.id,
        productName: products.name,
        createdAt: subscriptions.createdAt,
      })
        .from(subscriptions)
        .leftJoin(products, eq(subscriptions.productId, products.id))
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt)),

      db.select({
        provider: oauthAccounts.provider,
        providerAccountId: oauthAccounts.providerAccountId,
        createdAt: oauthAccounts.createdAt,
      }).from(oauthAccounts).where(eq(oauthAccounts.userId, userId)),

      // Token identity only — never the raw token value.
      db.select({
        id: usersTokens.id,
        name: usersTokens.name,
        lastUsedAt: usersTokens.lastUsedAt,
        expiresAt: usersTokens.expiresAt,
        revoked: usersTokens.revoked,
        createdAt: usersTokens.createdAt,
      }).from(usersTokens).where(eq(usersTokens.userId, userId)).orderBy(desc(usersTokens.createdAt)),

      db.select().from(visitorProfiles).where(eq(visitorProfiles.userId, userId)).orderBy(desc(visitorProfiles.lastSeenAt)).limit(1),

      db.select({
        role: promoMembers.role,
        status: promoMembers.status,
        promoCode: promoMembers.promoCode,
        inviteCode: promoMembers.inviteCode,
        agentCode: promoMembers.agentCode,
        joinedAt: promoMembers.joinedAt,
      }).from(promoMembers).where(eq(promoMembers.userId, userId)).limit(1),
    ])

    const totalSpent = orderRows.reduce((sum: number, o: (typeof orderRows)[number]) => sum + (o.payStatus === 'paid' ? Number(o.amount || 0) : 0), 0)

    return {
      user: {
        ...user,
        cashBalance: toDisplayBalance(user.cashBalance),
        grantBalance: toDisplayBalance(user.grantBalance),
        subBalance: toDisplayBalance(user.subBalance),
      },
      stats: {
        totalOrders: orderRows.length,
        totalSpent,
        unpaidOrders: orderRows.filter((o: (typeof orderRows)[number]) => o.payStatus !== 'paid').length,
      },
      orders: orderRows,
      subscriptions: subscriptionRows,
      oauthAccounts: oauthRows,
      tokens: tokenRows,
      profile: profileRows[0] || null,
      promoMember: promoRows[0] || null,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || (locale === 'zh' ? '获取用户详情失败' : 'Failed to fetch user detail'),
    })
  }
})
