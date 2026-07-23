import { orders, products, settings, users } from "../../db/schema"
import { eq, and, desc, gte } from "drizzle-orm"
import crypto from "crypto"
import { z } from "zod"
import { db } from '../../db/runtime'
import { ORDER_STATUS, ORDER_PAY_STATUS } from '../../utils/constants'
import { ensureVisitorId, trackVisitorEvent } from '../../utils/visitorAnalytics'
import { capturePromoTracking, createOrderAttribution, mergePromoTracking, readPromoTracking } from '../../promo/service'
import { sendEmail } from '../../utils/email'
import { createNotification } from '../../utils/notifications'

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

const getPreferredLocale = (event: any) => {
  const acceptLanguage = String(getHeaders(event)['accept-language'] || '').toLowerCase()
  return acceptLanguage.startsWith('zh') ? 'zh' : 'en'
}

const sendPendingOrderEmail = async (event: any, input: {
  email?: string | null
  nickname?: string | null
  orderId: string
  productName: string
  amount: number
}) => {
  if (!isDeliverableEmail(input.email)) return

  const siteUrl = getRequestURL(event).origin
  const recipient = String(input.email || '').trim()
  const nickname = String(input.nickname || recipient.split('@')[0] || 'Customer').trim()
  const siteNameSetting = await db.select()
    .from(settings)
    .where(eq(settings.key, 'site_name'))
    .limit(1)
  const siteName = String(siteNameSetting[0]?.value || 'APayShop').trim()

  sendEmail({
    to: recipient,
    templateCode: 'order_pending',
    locale: getPreferredLocale(event),
    variables: {
      nickname,
      order_id: input.orderId,
      product_name: input.productName,
      amount: Number(input.amount || 0).toFixed(2),
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
}) => {
  const locale = getPreferredLocale(event)
  const title = locale === 'zh' ? '订单待支付' : 'Payment Pending'
  const message = locale === 'zh'
    ? `您的 ${input.productName} 订单已创建，当前待支付金额为 $${Number(input.amount || 0).toFixed(2)}。点击继续完成支付。`
    : `Your ${input.productName} order has been created. $${Number(input.amount || 0).toFixed(2)} is still pending payment.`

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
        throw createError({ statusCode: 429, message: "Too many requests. Please try again later." })
      }
    }

    const body = await readBody(event)
    
    // Validate DTO with Zod
    const parsedBody = orderSchema.parse(body)
    
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
        throw createError({ statusCode: 401, message: "Guest checkout is disabled. Please log in to continue your purchase." })
      }
    }

    const visitorId = ensureVisitorId(event)
    const contactEmail = parsedBody.email || userEmail || visitorId + '@example.com'
    
    // 当前实现只支持单商品下单:DTO 允许多 items 但历史上静默截断为第一项,
    // 会生成金额不完整的订单——改为显式拒绝,直到真正支持多商品结算
    if (parsedBody.items.length > 1) {
      return { code: 1, message: "Multiple items are not supported yet, please checkout one product at a time" }
    }
    const firstItem = parsedBody.items[0]!
    if (!firstItem) {
      return { code: 1, message: "Invalid product information" }
    }
    const productId = firstItem.productId
    const productNum = firstItem.productNum

    // Check product existence and get price
    const productList = await db.select().from(products).where(eq(products.id, productId))
    if (productList.length === 0) {
      return { code: 1, message: "Product not found" }
    }

    const product = productList[0]

    // 可售状态检查:下架商品不允许下单(此前只查存在性,隐藏商品可被直接下单)
    if (product.isActive === false) {
      return { code: 1, message: "Product is not available for sale" }
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
    
    const finalMetaData = {
      ...(productMetaData.plan_ids ? { plan_ids: productMetaData.plan_ids } : {}),
      ...(promoTracking.inviteCode ? { inviteCode: promoTracking.inviteCode } : {}),
      ...(promoTracking.promoCode ? { promoCode: promoTracking.promoCode } : {}),
      ...(promoTracking.agentCode ? { agentCode: promoTracking.agentCode } : {}),
      ...(parsedBody.metaData || {})
    }
    
    if (Object.keys(finalMetaData).length > 0) {
      parsedBody.metaData = finalMetaData
    }

    // ==========================================
    // 订阅升级校验 (Subscription Upgrade Check)
    // ==========================================
    // 如果商品是 subscription 类型且用户已登录，检查用户当前 TierLevel
    // 只允许升级（新商品 level > 用户当前 TierLevel），不允许同级或降级重复购买
    if (product.type === 'subscription' && userId) {
      const productLevel = (productMetaData as any)?.level
      if (productLevel !== undefined) {
        const userRecord = await db.select({ TierLevel: users.TierLevel }).from(users).where(eq(users.id, userId)).limit(1)
        const currentLevel = userRecord.length > 0 ? (userRecord[0].TierLevel || 0) : 0
        if (Number(productLevel) <= Number(currentLevel)) {
          throw createError({
            statusCode: 409,
            message: "You already have an active subscription at this tier. Please upgrade to a higher plan."
          })
        }
      }
    }
    // ==========================================

    const totalAmount = product.price * productNum

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
      if (pendingOrder.amount === totalAmount) {
        // 可选：更新一下联系邮箱（如果用户换了邮箱）或用户ID（如果用户刚刚登录了）
        const updates: any = {}
        if (pendingOrder.contactEmail !== contactEmail) updates.contactEmail = contactEmail
        if (userId && pendingOrder.userId !== userId) updates.userId = userId
        if (parsedBody.metaData) updates.metaData = process.env.NUXT_HUB_DATABASE ? parsedBody.metaData : JSON.stringify(parsedBody.metaData) // Compat for Hub D1 vs local SQLite
        
        if (Object.keys(updates).length > 0) {
          await db.update(orders)
            .set(updates)
            .where(eq(orders.id, pendingOrder.id))
        }

        await createOrderAttribution({
          orderId: pendingOrder.id,
          buyerUserId: userId,
          metaData: finalMetaData,
        })

        await trackVisitorEvent(event, {
          visitorId,
          userId,
          orderId: pendingOrder.id,
          productId,
          eventName: 'begin_checkout',
        })

        await sendPendingOrderEmail(event, {
          email: parsedBody.email || userEmail || pendingOrder.contactEmail,
          nickname: userNickname,
          orderId: pendingOrder.id,
          productName: product.name,
          amount: totalAmount,
        })

        return {
          code: 0,
          message: "Order created successfully",
          data: {
            id: pendingOrder.id, // using orderId as checkoutId for now
            amount: totalAmount,
            currency: 'USD'
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
    
    // Create checkout order
    const orderData = {
      id: orderId,
      productId,
      amount: totalAmount,
      status: ORDER_STATUS.NONE, // Fulfillment status
      payStatus: ORDER_PAY_STATUS.PENDING, // Payment status
      contactEmail: contactEmail,
      payMethod: parsedBody.payMethod || 'none', // Ensure payMethod is set here so Webhook can find it later
      visitorId: visitorId,
      userId: userId, // Link to registered user if logged in
      metaData: parsedBody.metaData ? (process.env.NUXT_HUB_DATABASE ? parsedBody.metaData : JSON.stringify(parsedBody.metaData)) : null, // Compat for Hub D1 vs local SQLite
      createdAt: new Date()
    }
    
    await db.insert(orders).values(orderData).returning()

    await createOrderAttribution({
      orderId,
      buyerUserId: userId,
      metaData: finalMetaData,
    })

    await trackVisitorEvent(event, {
      visitorId,
      userId,
      orderId,
      productId,
      eventName: 'begin_checkout',
    })

    await createPendingOrderNotification(event, {
      userId,
      visitorId,
      orderId,
      productName: product.name,
      amount: totalAmount,
    })

    await sendPendingOrderEmail(event, {
      email: parsedBody.email || userEmail || contactEmail,
      nickname: userNickname,
      orderId,
      productName: product.name,
      amount: totalAmount,
    })
    
    return {
      code: 0,
      message: "Order created successfully",
      data: {
        id: orderId, // using orderId as checkoutId for now
        amount: totalAmount,
        currency: 'USD'
      }
    }
  } catch (error: any) {
    return { code: 1, message: "Failed to create order: " + error.message }
  }
})
