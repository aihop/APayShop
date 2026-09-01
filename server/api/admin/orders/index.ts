import { orders, products, users } from "../../../db/schema"
import { and, eq, ne, desc, count, or, like, sql } from "drizzle-orm"
import crypto from "crypto"
import { z } from "zod"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'
import { setAuditMeta } from '../../../utils/auditLog'
import { ORDER_PAY_STATUS, ORDER_STATUS } from '../../../utils/constants'
import { buildLocaleCurrencyQuote } from '../../../utils/localeCurrency'
import { getSiteLocaleConfig, resolveRequestLocale } from '../../../utils/paymentMethodLocales'
import { requireTrustedRequestOrigin } from '../../../utils/domainLocale'
import { fulfillOrder } from '../../../utils/fulfillment'
import { emitEvent } from '../../../utils/eventActions'
import { createOrderAttribution, settlePromoCommission, ensurePromoMember } from '../../../promo/service'
import {
  buildMinimalCheckoutBridgeMeta,
  getMinimalCheckoutAdminConfig,
  mergeMinimalCheckoutMeta,
  prepareOrderMetaForInsert,
  readMinimalCheckoutBridgeMeta,
  fulfillMinimalCheckoutRelay,
  isMinimalCheckoutRelayOrder,
} from '../../../utils/checkoutBridge'
import { ensureTopupRecordForOrder, settlePaidTopup } from '../../../utils/topupLedger'
import { sendEmail } from '../../../utils/email'
import { getLocalizedSettingValue } from '../../../utils/localizedSettings'

const manualOrderSchema = z.object({
  userId: z.union([z.number(), z.string()]).optional().nullable(),
  email: z.string().email().optional().nullable(),
  nickname: z.string().optional().nullable(),
  productId: z.union([z.number(), z.string()]),
  quantity: z.number().int().positive().optional().default(1),
  amount: z.number().min(0).optional().nullable(),
  currency: z.string().optional().nullable(),
  payStatus: z.enum(['pending', 'paid']).optional().default('paid'),
  payMethod: z.string().optional().nullable(),
  tradeNo: z.string().optional().nullable(),
  autoFulfill: z.boolean().optional().default(true),
  deliveryInfo: z.string().optional().nullable(),
  sendEmail: z.boolean().optional().default(false),
  metaData: z.record(z.string(), z.any()).optional().nullable(),
  locale: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)

  if (event.method === "GET") {
    const query = getQuery(event)
    const page = Math.max(parseInt(query.page as string) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 15, 1), 100)
    const offset = (page - 1) * pageSize
    const payStatus = String(query.payStatus || '').trim()
    const status = String(query.status || '').trim()
    const search = String(query.search || query.q || query.keyword || '').trim()

    const isDeletedQuery = payStatus === 'deleted' || status === 'deleted'

    const filterConditions = []

    if (isDeletedQuery) {
      // 回收站模式：仅查询已删除订单
      filterConditions.push(or(eq(orders.payStatus, 'deleted'), eq(orders.status, 'deleted')))
    } else {
      // 常规模式（全部/各支付状态/各履约状态）：严格排除已删除订单
      filterConditions.push(and(
        ne(orders.payStatus, 'deleted'),
        ne(orders.status, 'deleted')
      ))

      if (payStatus && payStatus !== 'all') {
        filterConditions.push(eq(orders.payStatus, payStatus))
      }
      if (status && status !== 'all') {
        filterConditions.push(eq(orders.status, status))
      }
    }

    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`
      filterConditions.push(or(
        like(sql`lower(${orders.id})`, searchPattern),
        like(sql`lower(coalesce(${orders.tradeNo}, ''))`, searchPattern),
        like(sql`lower(coalesce(${orders.contactEmail}, ''))`, searchPattern),
        like(sql`lower(coalesce(${orders.visitorId}, ''))`, searchPattern),
        like(sql`lower(coalesce(${products.name}, ''))`, searchPattern),
        like(sql`lower(coalesce(${users.email}, ''))`, searchPattern),
        like(sql`lower(coalesce(${users.nickname}, ''))`, searchPattern),
      ))
    }

    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

    // 全局指标统计：有效订单统计严格排除 deleted；deleted 独立统计总量
    const statsResult = await db.select({
      total: sql<number>`SUM(CASE WHEN ${orders.payStatus} != 'deleted' AND ${orders.status} != 'deleted' THEN 1 ELSE 0 END)`,
      paid: sql<number>`SUM(CASE WHEN ${orders.payStatus} = 'paid' AND ${orders.status} != 'deleted' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${orders.payStatus} = 'pending' AND ${orders.status} != 'deleted' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${orders.payStatus} = 'failed' AND ${orders.status} != 'deleted' THEN 1 ELSE 0 END)`,
      refunded: sql<number>`SUM(CASE WHEN ${orders.payStatus} = 'refunded' AND ${orders.status} != 'deleted' THEN 1 ELSE 0 END)`,
      deleted: sql<number>`SUM(CASE WHEN ${orders.payStatus} = 'deleted' OR ${orders.status} = 'deleted' THEN 1 ELSE 0 END)`,
    }).from(orders)

    const stats = {
      total: Number(statsResult[0]?.total || 0),
      paid: Number(statsResult[0]?.paid || 0),
      pending: Number(statsResult[0]?.pending || 0),
      failed: Number(statsResult[0]?.failed || 0),
      refunded: Number(statsResult[0]?.refunded || 0),
      deleted: Number(statsResult[0]?.deleted || 0),
    }

    // Filtered total count
    const totalQuery = db.select({ value: count() })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .leftJoin(users, eq(orders.userId, users.id))

    if (whereClause) {
      totalQuery.where(whereClause)
    }
    const totalResult = await totalQuery
    const total = totalResult[0]?.value || 0

    // Filtered data rows
    const dataQuery = db.select({
      id: orders.id,
      amount: orders.amount,
      currency: orders.currency,
      status: orders.status,
      payStatus: orders.payStatus,
      contactEmail: orders.contactEmail,
      payMethod: orders.payMethod,
      tradeNo: orders.tradeNo,
      visitorId: orders.visitorId,
      createdAt: orders.createdAt,
      productName: products.name,
      productSlug: products.slug,
      productId: products.id,
      productImage: products.imageUrl,
      productType: products.type,
      userNickname: users.nickname,
      userEmail: users.email
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .leftJoin(users, eq(orders.userId, users.id))

    if (whereClause) {
      dataQuery.where(whereClause)
    }

    const result = await dataQuery
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset)
    
    return {
      data: result,
      total,
      page,
      pageSize,
      stats,
    }
  }

  if (event.method === "POST") {
    const rawBody = await readBody(event)
    const parsed = manualOrderSchema.safeParse(rawBody)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: parsed.error.issues[0]?.message || (locale === 'zh' ? '参数验证失败' : 'Invalid request parameters'),
      })
    }

    const body = parsed.data
    const siteUrl = requireTrustedRequestOrigin(event)

    // 1. Resolve or create user
    let userRecord: typeof users.$inferSelect | null = null
    const rawUserId = body.userId ? Number(body.userId) : null

    if (rawUserId && Number.isFinite(rawUserId) && rawUserId > 0) {
      const existingUser = await db.select().from(users).where(eq(users.id, rawUserId)).limit(1)
      if (existingUser.length > 0) {
        userRecord = existingUser[0]
      }
    }

    if (!userRecord) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) {
        throw createError({
          statusCode: 400,
          message: locale === 'zh' ? '客户邮箱不能为空' : 'Customer email is required',
        })
      }

      const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (existingByEmail.length > 0) {
        userRecord = existingByEmail[0]
      } else {
        // Create new user automatically
        const nickname = String(body.nickname || '').trim() || email.split('@')[0] || 'Customer'
        try {
          const newUser = await db.insert(users).values({
            email,
            nickname,
            createdAt: new Date(),
          }).returning()
          userRecord = newUser[0]
        } catch (err) {
          // Handle concurrent insert collision
          const raced = await db.select().from(users).where(eq(users.email, email)).limit(1)
          if (raced.length > 0) {
            userRecord = raced[0]
          } else {
            throw err
          }
        }

        if (userRecord?.id) {
          await ensurePromoMember(userRecord.id).catch(() => {})
          // Link past guest orders with matching email
          await db.update(orders).set({ userId: userRecord.id }).where(eq(orders.contactEmail, userRecord.email)).catch(() => {})
        }
      }
    }

    if (!userRecord) {
      throw createError({
        statusCode: 400,
        message: locale === 'zh' ? '无法获取或创建客户账号' : 'Failed to resolve or create customer account',
      })
    }

    // 2. Resolve product
    const targetProductId = Number(body.productId)
    const productList = await db.select().from(products).where(eq(products.id, targetProductId)).limit(1)
    if (productList.length === 0) {
      throw createError({
        statusCode: 400,
        message: locale === 'zh' ? '商品不存在' : 'Product not found',
      })
    }

    const product = productList[0]
    const quantity = Math.max(1, body.quantity || 1)

    // 3. Amount & Currency Calculation
    const defaultTotal = Number(product.price || 0) * quantity
    const actualAmount = (body.amount !== undefined && body.amount !== null && Number.isFinite(Number(body.amount)))
      ? Math.max(0, Number(body.amount))
      : defaultTotal

    const siteLocaleConfig = await getSiteLocaleConfig()
    const orderLocale = resolveRequestLocale(event, body.locale || undefined, siteLocaleConfig)
    const currencyQuote = await buildLocaleCurrencyQuote(actualAmount, orderLocale)
    const finalCurrency = String(body.currency || currencyQuote.currency || 'USD').trim().toUpperCase()

    const currencySnapshot = {
      locale: currencyQuote.locale,
      baseCurrency: currencyQuote.baseCurrency,
      baseAmount: currencyQuote.baseAmount,
      currency: finalCurrency,
      exchangeRate: currencyQuote.rate,
      amount: actualAmount,
      source: 'admin_manual',
    }

    // 4. Generate Order ID
    const productTypePrefix = (product.type || 'OT').substring(0, 2).toUpperCase()
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    const timeSuffix = String(Date.now()).slice(-6)
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase()
    const orderId = `${productTypePrefix}${dateStr}${timeSuffix}${randomHex}`

    // 5. Construct MetaData & Minimal Bridge
    let productMetaData = product.metaData || {}
    if (typeof productMetaData === 'string') {
      try {
        productMetaData = JSON.parse(productMetaData)
      } catch {
        productMetaData = {}
      }
    }

    const minimalCheckoutConfig = await getMinimalCheckoutAdminConfig()
    const configuredRechargeAmount = Number((productMetaData as any).recharge_amount || 0)
    const rechargeAmount = configuredRechargeAmount > 0 ? configuredRechargeAmount : currencyQuote.baseAmount

    const bridgeMeta = buildMinimalCheckoutBridgeMeta({
      externalOrderId: orderId,
      sourceProductId: product.id,
      amount: actualAmount,
      currency: finalCurrency,
      sourceAmount: currencyQuote.baseAmount,
      sourceCurrency: currencyQuote.baseCurrency,
      exchangeRate: currencyQuote.rate,
      rechargeAmount,
      rechargeCurrency: String((productMetaData as any).display_unit || currencyQuote.baseCurrency).trim().toUpperCase(),
      balanceType: String((productMetaData as any).balance_type || '').trim().toLowerCase() === 'grant' ? 'grant' : 'cash',
      notifyUrl: minimalCheckoutConfig.defaultNotifyUrl || undefined,
      returnUrl: minimalCheckoutConfig.defaultReturnUrl || undefined,
      cancelUrl: minimalCheckoutConfig.defaultCancelUrl || undefined,
      customerEmail: userRecord.email,
      attach: {
        channel: 'admin_manual',
        businessType: product.type,
        sourceProductId: product.id,
        productName: product.name,
        productDescription: product.description,
        productImageUrl: product.imageUrl,
        productMeta: productMetaData,
        quantity,
        userId: userRecord.id,
        walletOwner: product.type === 'topup' ? 'apay' : 'external',
      },
    })

    const finalMetaData = mergeMinimalCheckoutMeta({
      ...(body.metaData || {}),
      ...(productMetaData.plan_ids ? { plan_ids: productMetaData.plan_ids } : {}),
      currencySnapshot,
    }, bridgeMeta)

    const isPaid = body.payStatus === ORDER_PAY_STATUS.PAID
    const payMethod = body.payMethod ? String(body.payMethod).trim() : (isPaid ? 'manual' : 'none')
    const tradeNo = body.tradeNo ? String(body.tradeNo).trim() : null
    const deliveryInfo = body.deliveryInfo ? String(body.deliveryInfo).trim() : null

    // 6. Insert Order
    const orderData = {
      id: orderId,
      productId: product.id,
      amount: actualAmount,
      currency: finalCurrency,
      source: 'minimal_checkout',
      externalOrderId: orderId,
      status: isPaid ? (body.autoFulfill ? ORDER_STATUS.PROCESSING : ORDER_STATUS.NONE) : ORDER_STATUS.NONE,
      payStatus: isPaid ? ORDER_PAY_STATUS.PAID : ORDER_PAY_STATUS.PENDING,
      paidAt: isPaid ? new Date() : null,
      contactEmail: userRecord.email,
      payMethod,
      tradeNo,
      deliveryInfo,
      visitorId: null,
      userId: userRecord.id,
      metaData: prepareOrderMetaForInsert(finalMetaData),
      createdAt: new Date(),
    }

    const result = await db.insert(orders).values(orderData).returning()
    const createdOrder = result[0]

    // 7. Handle Topup Ledger & Fulfillment if Paid
    if (isPaid) {
      await createOrderAttribution({
        orderId,
        buyerUserId: userRecord.id,
        metaData: finalMetaData,
      }).catch((e) => console.error('[ManualOrder] createOrderAttribution failed:', e))

      if (product.type === 'topup') {
        await ensureTopupRecordForOrder(orderId)
        await settlePaidTopup(orderId)
      }

      if (body.autoFulfill) {
        const isMinimalRelay = isMinimalCheckoutRelayOrder(createdOrder)
        const fulfilledOrder = isMinimalRelay
          ? await fulfillMinimalCheckoutRelay(orderId)
          : await fulfillOrder(orderId)

        if (fulfilledOrder) {
          await settlePromoCommission(orderId).catch((e) => console.error('[ManualOrder] settlePromoCommission failed:', e))
          await emitEvent('order.paid', fulfilledOrder).catch((e) => console.error('[ManualOrder] emitEvent failed:', e))
        }
      }
    }

    // 8. Send Email Notification if requested
    if (body.sendEmail) {
      const siteName = await getLocalizedSettingValue('site_name', orderLocale, 'APay')
      if (!isPaid) {
        sendEmail({
          to: userRecord.email,
          templateCode: 'order_pending',
          locale: orderLocale,
          variables: {
            nickname: userRecord.nickname || (userRecord.email ? userRecord.email.split('@')[0] : 'User') || 'User',
            order_id: orderId,
            product_name: product.name,
            amount: `${actualAmount.toFixed(2)} ${finalCurrency}`,
            currency: finalCurrency,
            site_name: siteName,
            site_url: siteUrl,
            payment_link: `${siteUrl}/payment/${orderId}`,
          },
        }).catch((err) => console.error('[ManualOrder] Failed to send pending email:', err))
      }
    }

    // 9. Audit Log
    setAuditMeta(event, {
      summary: `Created manual order ${orderId} for ${userRecord.email} (${actualAmount} ${finalCurrency}, ${isPaid ? 'paid' : 'pending'})`,
      details: {
        orderId,
        userId: userRecord.id,
        userEmail: userRecord.email,
        productId: product.id,
        productName: product.name,
        quantity,
        amount: actualAmount,
        currency: finalCurrency,
        payStatus: isPaid ? 'paid' : 'pending',
        payMethod,
        autoFulfill: body.autoFulfill,
      },
    })

    return {
      code: 0,
      message: locale === 'zh' ? '订单创建成功' : 'Order created successfully',
      data: {
        id: orderId,
        order: createdOrder,
        paymentUrl: `${siteUrl}/payment/${orderId}`,
      },
    }
  }
})
