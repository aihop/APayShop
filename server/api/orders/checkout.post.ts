import { orders, products, settings, users, userWallets } from "../../db/schema"
import { eq, and, desc, gte } from "drizzle-orm"
import crypto from "crypto"
import { z } from "zod"
import { db } from '../../db/runtime'
import { ORDER_STATUS, ORDER_PAY_STATUS } from '../../utils/constants'
import { ensureVisitorId, trackVisitorEvent } from '../../utils/visitorAnalytics'
import { capturePromoTracking, createOrderAttribution, mergePromoTracking, readPromoTracking } from '../../promo/service'
import { sendEmail } from '../../utils/email'
import { createNotification } from '../../utils/notifications'
import { getAffectedRows } from '../../utils/dbResult'
import { stripReservedOrderMeta } from '../../utils/orderMetaData'
import { getRequestLocale } from '../../utils/requestLocale'
import { getLocalizedSettingValue } from '../../utils/localizedSettings'
import { buildLocaleCurrencyQuote } from '../../utils/localeCurrency'
import { getSiteLocaleConfig, resolveRequestLocale } from '../../utils/paymentMethodLocales'
import {
  buildMinimalCheckoutBridgeMeta,
  getMinimalCheckoutAdminConfig,
  mergeMinimalCheckoutMeta,
  prepareOrderMetaForInsert,
} from '../../../app/themes/minimal/server/checkout/bridge'
import { fulfillMinimalCheckoutRelay } from '../../../app/themes/minimal/server/checkout/fulfillment'
import { deliverMinimalCheckoutPaid } from '../../../app/themes/minimal/server/checkout/notify'
import { ensureTopupRecordForOrder, settlePaidTopup } from '../../utils/topupLedger'

// metaData 是服务表单答案等自由字段,不强 schema(形态不固定),但收窄为
// 「普通对象 + 大小上限」:挡住数组/标量当 metaData、超大 payload 撑爆存储。
// 注意:存储型 XSS 的正确防线是渲染侧转义(Vue 默认已转义,禁止对其 v-html),
// 不在落库时 HTML 转义——那会污染数据并造成双重转义。
const METADATA_MAX_BYTES = 16 * 1024
const metaDataSchema = z.record(z.string(), z.any())
  .refine(obj => Buffer.byteLength(JSON.stringify(obj), 'utf8') <= METADATA_MAX_BYTES, {
    message: `metaData too large (max ${METADATA_MAX_BYTES} bytes)`,
  })

const orderSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  payMethod: z.string().optional(),
  locale: z.string().trim().min(1).max(35).optional(),
  metaData: metaDataSchema.optional(), // For service form answers or other custom data
  items: z.array(z.object({
    productId: z.number().int().positive(),
    productNum: z.number().int().positive()
  })).min(1, "At least one item is required")
})

// Simple in-memory rate limiter for demonstration. 
// For edge/serverless production, use `useStorage('cache')` or Redis KV.
const rateLimitMap = new Map<string, { count: number, resetTime: number }>()

const isDeliverableEmail = (value?: string | null) => {
  const email = String(value || '').trim()
  if (!email) return false
  return !email.endsWith('@example.com')
}

const getPreferredLocale = (event: any) => getRequestLocale(event)

const parseOrderMetaData = (value: unknown): Record<string, any> => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const matchesCurrencySnapshot = (value: unknown, snapshot: Record<string, any>) => {
  const current = parseOrderMetaData(value).currencySnapshot
  if (!current || typeof current !== 'object') return false
  return current.locale === snapshot.locale
    && current.baseCurrency === snapshot.baseCurrency
    && Number(current.baseAmount) === Number(snapshot.baseAmount)
    && current.currency === snapshot.currency
    && Number(current.exchangeRate) === Number(snapshot.exchangeRate)
    && Number(current.amount) === Number(snapshot.amount)
    && current.source === snapshot.source
}

const sendPendingOrderEmail = async (event: any, input: {
  email?: string | null
  nickname?: string | null
  orderId: string
  productName: string
  amount: number
  currency: string
  locale: string
}) => {
  if (!isDeliverableEmail(input.email)) return

  const siteUrl = getRequestURL(event).origin
  const recipient = String(input.email || '').trim()
  const nickname = String(input.nickname || recipient.split('@')[0] || 'Customer').trim()
  const siteName = await getLocalizedSettingValue('site_name', input.locale, 'APay')

  sendEmail({
    to: recipient,
    templateCode: 'order_pending',
    locale: input.locale,
    variables: {
      nickname,
      order_id: input.orderId,
      product_name: input.productName,
      amount: `${Number(input.amount || 0).toFixed(2)} ${input.currency}`,
      currency: input.currency,
      site_name: siteName,
      site_url: siteUrl,
      payment_link: `${siteUrl}/payment/${input.orderId}`,
    },
  }).catch((error) => {
    console.error('[Checkout] Failed to send pending payment email:', error)
  })
}

const createPendingOrderNotification = async (event: any, input: {
  userId?: number | null
  visitorId?: string | null
  orderId: string
  productName: string
  amount: number
  currency: string
}) => {
  const locale = getPreferredLocale(event)
  const title = locale === 'zh' ? '订单待支付' : 'Payment Pending'
  const message = locale === 'zh'
    ? `您的 ${input.productName} 订单已创建，当前待支付金额为 ${Number(input.amount || 0).toFixed(2)} ${input.currency}。点击继续完成支付。`
    : `Your ${input.productName} order has been created. ${Number(input.amount || 0).toFixed(2)} ${input.currency} is still pending payment.`

  await createNotification({
    userId: input.userId ?? null,
    visitorId: input.visitorId ?? null,
    type: 'order_pending',
    title,
    message,
    data: {
      orderId: input.orderId,
      payStatus: 'pending',
      targetPath: `/payment/${input.orderId}`,
    },
  })
}

export default defineEventHandler(async (event) => {
  try {
    const locale = getPreferredLocale(event)
    const messages = locale === 'zh'
      ? {
          tooManyRequests: '请求过于频繁，请稍后再试。',
          guestCheckoutDisabled: '当前未开启游客下单，请先登录后再继续购买。',
          multipleItemsUnsupported: '暂不支持多商品同时下单，请一次只购买一个商品。',
          invalidProductInfo: '商品信息无效',
          productNotFound: '商品不存在',
          productUnavailable: '商品当前不可售',
          topupLoginRequired: '请先登录后再充值',
          invalidTopupAmount: '充值到账金额必须大于 0',
          activeSubscriptionExists: '您当前已拥有同级有效订阅，请升级到更高等级的套餐。',
          purchaseLimitExceeded: '您已达到该商品的购买上限，无法再次购买。',
          purchaseLimitExceededWithCount: '该商品每人最多可购买 {limit} 次，您已购买过 {count} 次。',
          orderCreated: '订单创建成功',
          createOrderFailed: '创建订单失败：',
        }
      : {
          tooManyRequests: 'Too many requests. Please try again later.',
          guestCheckoutDisabled: 'Guest checkout is disabled. Please log in to continue your purchase.',
          multipleItemsUnsupported: 'Multiple items are not supported yet, please checkout one product at a time',
          invalidProductInfo: 'Invalid product information',
          productNotFound: 'Product not found',
          productUnavailable: 'Product is not available for sale',
          topupLoginRequired: 'Please log in before topping up',
          invalidTopupAmount: 'Top-up credit amount must be greater than 0',
          activeSubscriptionExists: 'You already have an active subscription at this tier. Please upgrade to a higher plan.',
          purchaseLimitExceeded: 'You have reached the purchase limit for this product.',
          purchaseLimitExceededWithCount: 'This product can only be purchased {limit} time(s) per user. You have already purchased it {count} time(s).',
          orderCreated: 'Order created successfully',
          createOrderFailed: 'Failed to create order: ',
        }
    const promoTracking = mergePromoTracking(
      readPromoTracking(event),
      await capturePromoTracking(event),
    )

    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    const now = Date.now()
    
    // Rate Limiting: Max 5 orders per minute per IP
    let rateData = rateLimitMap.get(ip)
    if (!rateData || rateData.resetTime < now) {
      rateData = { count: 1, resetTime: now + 60000 }
      rateLimitMap.set(ip, rateData)
    } else {
      rateData.count++
      if (rateData.count > 5) {
        throw createError({ statusCode: 429, message: messages.tooManyRequests })
      }
    }

    const body = await readBody(event)

    // Validate DTO with Zod
    const parsedResult = orderSchema.safeParse(body)
    if (!parsedResult.success) {
      return {
        code: 1,
        message: locale === 'zh' ? '下单参数无效' : 'Invalid checkout payload',
      }
    }
    const parsedBody = parsedResult.data
    
    // Check if user is logged in
    let userId = null;
    let userEmail: string | null = null
    let userNickname: string | null = null
    const session = await requireUserSession(event).catch(() => null)
    if (session && session.user) {
      userId = (session.user as any).id
      userEmail = String((session.user as any).email || '').trim() || null
      userNickname = String((session.user as any).nickname || '').trim() || null
      
      // Verify user actually exists in the database to prevent FK constraint errors
      // (happens when a user is deleted but their session cookie remains)
      const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
      if (userExists.length === 0) {
        userId = null // fallback to guest
        userEmail = null
        userNickname = null
        // Optionally, we could clear the session here: await clearUserSession(event)
        await clearUserSession(event).catch(() => null)
      }
    }

    // Check guest checkout permission
    if (!userId) {
      const guestCheckoutSetting = await db.select().from(settings).where(eq(settings.key, 'allow_guest_checkout')).limit(1)
      const allowGuestCheckout = guestCheckoutSetting.length > 0 ? guestCheckoutSetting[0].value === 'true' : true
      if (!allowGuestCheckout) {
        throw createError({ statusCode: 401, message: messages.guestCheckoutDisabled })
      }
    }

    const visitorId = ensureVisitorId(event)
    const contactEmail = parsedBody.email || userEmail || visitorId + '@example.com'
    
    // 当前实现只支持单商品下单:DTO 允许多 items 但历史上静默截断为第一项,
    // 会生成金额不完整的订单——改为显式拒绝,直到真正支持多商品结算
    if (parsedBody.items.length > 1) {
      return { code: 1, message: messages.multipleItemsUnsupported }
    }
    const firstItem = parsedBody.items[0]!
    if (!firstItem) {
      return { code: 1, message: messages.invalidProductInfo }
    }
    const productId = firstItem.productId
    const productNum = firstItem.productNum

    // Check product existence and get price
    const productList = await db.select().from(products).where(eq(products.id, productId))
    if (productList.length === 0) {
      return { code: 1, message: messages.productNotFound }
    }

    const product = productList[0]

    // 可售状态检查:下架商品不允许下单(此前只查存在性,隐藏商品可被直接下单)
    if (product.isActive === false) {
      return { code: 1, message: messages.productUnavailable }
    }
    if (product.type === 'topup' && !userId) {
      throw createError({ statusCode: 401, message: messages.topupLoginRequired })
    }
    
    // Prepare metaData for the order by merging product's plan_ids (if any) with user's metaData
    let productMetaData = product.metaData || {}
    if (typeof productMetaData === 'string') {
      try {
        productMetaData = JSON.parse(productMetaData)
      } catch (e) {
        productMetaData = {}
      }
    }
    
    // 客户端 metaData 先展开、且剔除记账保留键(recharge_amount/balance_type/
    // integration/plan_ids):这些字段决定发给 ainode 的入账金额与余额池,只能由
    // 服务端按商品配置写入。此前客户端 metaData 最后展开可整体覆盖,等于买家
    // 自定义到账额度,详见 utils/orderMetaData.ts。
    const checkoutLocale = resolveRequestLocale(event, parsedBody.locale, await getSiteLocaleConfig())
    const currencyQuote = await buildLocaleCurrencyQuote(
      product.price * productNum,
      checkoutLocale,
    )
    const totalAmount = currencyQuote.amount
    const configuredRechargeAmount = Number((productMetaData as any).recharge_amount || 0)
    const rechargeAmount = configuredRechargeAmount > 0
      ? configuredRechargeAmount
      : currencyQuote.baseAmount
    if (product.type === 'topup' && (!(totalAmount > 0) || !(rechargeAmount > 0))) {
      throw createError({ statusCode: 400, message: messages.invalidTopupAmount })
    }
    const currencySnapshot = {
      locale: currencyQuote.locale,
      baseCurrency: currencyQuote.baseCurrency,
      baseAmount: currencyQuote.baseAmount,
      currency: currencyQuote.currency,
      exchangeRate: currencyQuote.rate,
      amount: currencyQuote.amount,
      source: currencyQuote.source,
    }
    const minimalCheckoutConfig = await getMinimalCheckoutAdminConfig()
    const finalMetaData: Record<string, any> = {
      ...stripReservedOrderMeta(parsedBody.metaData),
      ...(productMetaData.plan_ids ? { plan_ids: productMetaData.plan_ids } : {}),
      ...(promoTracking.inviteCode ? { inviteCode: promoTracking.inviteCode } : {}),
      ...(promoTracking.promoCode ? { promoCode: promoTracking.promoCode } : {}),
      ...(promoTracking.agentCode ? { agentCode: promoTracking.agentCode } : {}),
      currencySnapshot,
    }
    
    const buildRelayOrderMeta = (externalOrderId: string) => {
      const rechargeCurrency = String(
        (productMetaData as any).display_unit || currencyQuote.baseCurrency,
      ).trim().toUpperCase()
      const balanceType = String((productMetaData as any).balance_type || '').trim().toLowerCase() === 'grant'
        ? 'grant'
        : 'cash'
      const bridgeMeta = buildMinimalCheckoutBridgeMeta({
        externalOrderId,
        sourceProductId: product.id,
        amount: currencyQuote.amount,
        currency: currencyQuote.currency,
        sourceAmount: currencyQuote.baseAmount,
        sourceCurrency: currencyQuote.baseCurrency,
        exchangeRate: currencyQuote.rate,
        rechargeAmount,
        rechargeCurrency,
        balanceType,
        notifyUrl: minimalCheckoutConfig.defaultNotifyUrl || undefined,
        returnUrl: minimalCheckoutConfig.defaultReturnUrl || undefined,
        cancelUrl: minimalCheckoutConfig.defaultCancelUrl || undefined,
        customerEmail: contactEmail,
        attach: {
          channel: 'qingpu-storefront',
          businessType: product.type,
          sourceProductId: product.id,
          productName: product.name,
          productDescription: product.description,
          productImageUrl: product.imageUrl,
          productMeta: productMetaData,
          quantity: productNum,
          userId,
          walletOwner: product.type === 'topup' ? 'apay' : 'external',
        },
      })
      return mergeMinimalCheckoutMeta(finalMetaData, bridgeMeta)
    }

    const fulfillFreeRelayOrder = async (targetOrderId: string) => {
      const fulfilled = await fulfillMinimalCheckoutRelay(targetOrderId)
      if (!fulfilled) return
      await deliverMinimalCheckoutPaid(fulfilled)
    }

    // ==========================================
    // 订阅升级校验 (Subscription Upgrade Check)
    // ==========================================
    // 如果商品是 subscription 类型且用户已登录，检查用户当前钱包 TierLevel
    // 只允许升级（新商品 level > 用户当前 TierLevel），不允许同级或降级重复购买
    if (product.type === 'subscription' && userId) {
      const productLevel = (productMetaData as any)?.level
      if (productLevel !== undefined) {
        const walletRecord = await db.select({ tierLevel: userWallets.tierLevel })
          .from(userWallets).where(eq(userWallets.userId, userId)).limit(1)
        const currentLevel = walletRecord.length > 0 ? (walletRecord[0].tierLevel || 0) : 0
        if (Number(productLevel) <= Number(currentLevel)) {
          throw createError({
            statusCode: 409,
            message: messages.activeSubscriptionExists
          })
        }
      }
    }
    // ==========================================

    // ==========================================
    // 每用户购买次数限制 (Per-User Purchase Limit)
    // ==========================================
    // 规则优先级:
    //   1) metaData.perUserLimit: 正整数 → 显式限制为 N 次
    //   2) metaData.perUserLimit === 0 或其他 falsy 且未配置 → 不限制
    //   3) 但若商品为 0 元(totalAmount <= 0)且未显式设置 perUserLimit → 默认限制为 1 次
    //      (防止免费/试用商品被同一人反复刷订单触发履约)
    // 计数口径: 同一 productId 下,对该用户(userId 优先, 退化到 visitorId 兜底)
    //           payStatus == PAID 的订单总数;复用中的 pending 单不计入已购次数。
    {
      const rawLimit = (productMetaData as any)?.perUserLimit
      const explicitLimit = Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : null
      const effectiveLimit: number | null =
        explicitLimit !== null && explicitLimit > 0
          ? Math.floor(explicitLimit)
          : (explicitLimit !== null && explicitLimit === 0
              ? null
              : (totalAmount <= 0 ? 1 : null))

      if (effectiveLimit !== null && effectiveLimit > 0) {
        const paidCountQuery = db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.payStatus, ORDER_PAY_STATUS.PAID),
              eq(orders.productId, productId),
              userId
                ? eq(orders.userId, userId)
                : eq(orders.visitorId, visitorId),
            ),
          )
        const paidRows = await paidCountQuery
        const paidCount = paidRows.length

        if (paidCount >= effectiveLimit) {
          const message =
            locale === 'zh'
              ? `该商品每人最多可购买 ${effectiveLimit} 次，您已购买过 ${paidCount} 次。`
              : `This product can only be purchased ${effectiveLimit} time(s) per user. You have already purchased it ${paidCount} time(s).`
          throw createError({
            statusCode: 409,
            message,
          })
        }
      }
    }
    // ==========================================

    // ==========================================
    // 订单复用逻辑 (Order Reuse Logic)
    // ==========================================
    // 查找该用户（根据 visitorId 或 email）针对该商品，最近是否有未支付（pending）的订单
    // 为了防止太久远的订单价格不一致，我们只复用最近 1 小时内创建的未支付订单
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const existingPendingOrders = await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.payStatus, ORDER_PAY_STATUS.PENDING),
          eq(orders.productId, productId),
          eq(orders.visitorId, visitorId), // 必须是同一个访客
          gte(orders.createdAt, oneHourAgo) // 必须是1小时内的订单
        )
      )
      .orderBy(desc(orders.createdAt)) // 获取最新的一笔
      .limit(1)

    if (existingPendingOrders.length > 0) {
      const pendingOrder = existingPendingOrders[0]
      
      // 如果金额一致（防止这段时间内商品改价了），直接复用该订单
      if (
        pendingOrder.amount === totalAmount
        && pendingOrder.currency === currencyQuote.currency
        && matchesCurrencySnapshot(pendingOrder.metaData, currencySnapshot)
      ) {
        // 可选：更新一下联系邮箱（如果用户换了邮箱）或用户ID（如果用户刚刚登录了）
        const relayOrderMeta = buildRelayOrderMeta(pendingOrder.id)
        const updates: any = {
          source: 'minimal_checkout',
          externalOrderId: pendingOrder.id,
          metaData: prepareOrderMetaForInsert(relayOrderMeta),
        }
        if (pendingOrder.contactEmail !== contactEmail) updates.contactEmail = contactEmail
        if (userId && pendingOrder.userId !== userId) updates.userId = userId
        
        if (Object.keys(updates).length > 0) {
          await db.update(orders)
            .set(updates)
            .where(eq(orders.id, pendingOrder.id))
        }

        if (product.type === 'topup') {
          await ensureTopupRecordForOrder(pendingOrder.id)
        }

        await createOrderAttribution({
          orderId: pendingOrder.id,
          buyerUserId: userId,
          metaData: relayOrderMeta,
        })

        await trackVisitorEvent(event, {
          visitorId,
          userId,
          orderId: pendingOrder.id,
          productId,
          eventName: 'begin_checkout',
        })

        // ==========================================
        // 0 元订单直接放行：标记已支付 + 立即履约，跳过支付网关
        // ==========================================
        let isFreeOrder = false
        if (totalAmount <= 0) {
          const claim = await db.update(orders)
            .set({
              payStatus: ORDER_PAY_STATUS.PAID,
              status: ORDER_STATUS.PROCESSING,
              paidAt: new Date(),
            })
            .where(and(
              eq(orders.id, pendingOrder.id),
              eq(orders.payStatus, ORDER_PAY_STATUS.PENDING),
            ))
          // 履约后必须派发 order.paid:integration.transaction(如试用商品的送钱)
          // 只经这个事件到达 ainode——真实支付路径由回调派发,0 元单没有回调,
          // 不在这里发就永远不入账(试用开通"送钱"断链的真实事故)
          if (getAffectedRows(claim) > 0) {
            if (product.type === 'topup') await settlePaidTopup(pendingOrder.id)
            await fulfillFreeRelayOrder(pendingOrder.id).catch((e) =>
              console.error('[Checkout] Free relay order reuse fulfillment failed:', pendingOrder.id, e),
            )
          }
          isFreeOrder = true
        } else {
          await sendPendingOrderEmail(event, {
            email: parsedBody.email || userEmail || pendingOrder.contactEmail,
            nickname: userNickname,
            orderId: pendingOrder.id,
            productName: product.name,
            amount: totalAmount,
            currency: currencyQuote.currency,
            locale: checkoutLocale,
          })
        }

        return {
          code: 0,
          message: messages.orderCreated,
          data: {
            id: pendingOrder.id, // using orderId as checkoutId for now
            amount: totalAmount,
            currency: currencyQuote.currency,
            isFreeOrder,
          }
        }
      }
    }
    // ==========================================
    
    // Generate order ID
    // 规则: 产品类型前两个字母 (大写) + 年月日 (YYYYMMDD) + 随机数 (时间戳后几位+随机Hex)
    const productTypePrefix = (product.type || 'OT').substring(0, 2).toUpperCase()
    
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    
    // 取时间戳的后 6 位，加上 8 位的随机 hex (共 14 位随机字符)
    const timeSuffix = String(Date.now()).slice(-6)
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase()
    
    const orderId = `${productTypePrefix}${dateStr}${timeSuffix}${randomHex}`
    
    const isFreeOrder = totalAmount <= 0
    const relayOrderMeta = buildRelayOrderMeta(orderId)

    // Create checkout order
    const orderData = {
      id: orderId,
      productId,
      amount: totalAmount,
      currency: currencyQuote.currency,
      source: 'minimal_checkout',
      externalOrderId: orderId,
      status: ORDER_STATUS.NONE, // Fulfillment status
      payStatus: isFreeOrder ? ORDER_PAY_STATUS.PAID : ORDER_PAY_STATUS.PENDING, // 0 元直接视为已支付
      paidAt: isFreeOrder ? new Date() : null,
      contactEmail: contactEmail,
      payMethod: parsedBody.payMethod || 'none', // Ensure payMethod is set here so Webhook can find it later
      visitorId: visitorId,
      userId: userId, // Link to registered user if logged in
      metaData: prepareOrderMetaForInsert(relayOrderMeta),
      createdAt: new Date()
    }
    
    await db.insert(orders).values(orderData).returning()

    if (product.type === 'topup') {
      try {
        await ensureTopupRecordForOrder(orderId)
      } catch (error) {
        await db.update(orders).set({ payStatus: ORDER_PAY_STATUS.FAILED, status: ORDER_STATUS.FAILED }).where(eq(orders.id, orderId))
        throw error
      }
    }

    await createOrderAttribution({
      orderId,
      buyerUserId: userId,
      metaData: relayOrderMeta,
    })

    await trackVisitorEvent(event, {
      visitorId,
      userId,
      orderId,
      productId,
      eventName: 'begin_checkout',
    })

    if (isFreeOrder) {
      // 0 元单：直接履约，跳过"待支付"邮件/通知。
      // 履约后必须派发 order.paid:integration.transaction(如试用商品的送钱)只经
      // 这个事件到达 ainode——真实支付路径由回调派发,0 元单没有回调,这里不发就
      // 永远不入账(试用开通"送钱"断链的真实事故)
      if (product.type === 'topup') await settlePaidTopup(orderId)
      await fulfillFreeRelayOrder(orderId).catch((e) =>
        console.error('[Checkout] Free relay order fulfillment failed:', orderId, e),
      )
    } else {
      await createPendingOrderNotification(event, {
        userId,
        visitorId,
        orderId,
        productName: product.name,
        amount: totalAmount,
        currency: currencyQuote.currency,
      })

      await sendPendingOrderEmail(event, {
        email: parsedBody.email || userEmail || contactEmail,
        nickname: userNickname,
        orderId,
        productName: product.name,
        amount: totalAmount,
        currency: currencyQuote.currency,
        locale: checkoutLocale,
      })
    }
    
    return {
      code: 0,
      message: messages.orderCreated,
      data: {
        id: orderId, // using orderId as checkoutId for now
        amount: totalAmount,
        currency: currencyQuote.currency,
        isFreeOrder,
      }
    }
  } catch (error: any) {
    const locale = getPreferredLocale(event)
    const failedPrefix = locale === 'zh' ? '创建订单失败：' : 'Failed to create order: '
    return { code: 1, message: `${failedPrefix}${error.message}` }
  }
})
