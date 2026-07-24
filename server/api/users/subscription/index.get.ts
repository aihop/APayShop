import { subscriptions, products } from "../../../db/schema"
import { eq, and, desc } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from "../../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const userId = session.user.id

  // Find the latest active subscription for this user
  const subRows = await db.select({
    id: subscriptions.id,
    status: subscriptions.status,
    interval: subscriptions.interval,
    intervalCount: subscriptions.intervalCount,
    amount: subscriptions.amount,
    currency: subscriptions.currency,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    createdAt: subscriptions.createdAt,
    productId: products.id,
    productName: products.name,
    productSlug: products.slug,
    productType: products.type,
    productMetaData: products.metaData,
  })
    .from(subscriptions)
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active'),
    ))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  if (!subRows.length) {
    return { data: null }
  }

  const sub = subRows[0]

  // Parse metaData for tier and grantAmount
  let productMeta: any = {}
  if (sub.productMetaData) {
    try {
      productMeta = typeof sub.productMetaData === 'string'
        ? JSON.parse(sub.productMetaData)
        : sub.productMetaData
    } catch { /* ignore */ }
  }

  return {
    data: {
      id: sub.id,
      status: sub.status,
      tier: productMeta.level || 0,
      grantAmount: productMeta.grant_amount || 0,
      planName: sub.productName || (locale === 'zh' ? '未知套餐' : 'Unknown'),
      interval: sub.interval,
      intervalCount: sub.intervalCount,
      amount: sub.amount,
      currency: sub.currency,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      createdAt: sub.createdAt,
    },
  }
})
