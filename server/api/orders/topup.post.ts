import crypto from 'crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { orders, users } from '../../db/schema'
import { ORDER_STATUS, ORDER_PAY_STATUS } from '../../utils/constants'
import { ensureVisitorId, trackVisitorEvent } from '../../utils/visitorAnalytics'
import { capturePromoTracking, createOrderAttribution, mergePromoTracking, readPromoTracking } from '../../promo/service'
import { createNotification } from '../../utils/notifications'
import { buildTopupQuote, ensureTopupCarrierProduct, getTopupRules, TopupValidationError } from '../../utils/topup'
import { getRequestLocale } from '../../utils/requestLocale'
import {
  buildMinimalCheckoutBridgeMeta,
  getMinimalCheckoutAdminConfig,
  mergeMinimalCheckoutMeta,
  prepareOrderMetaForInsert,
} from '../../../app/themes/minimal/server/checkout/bridge'

/**
 * 快捷充值下单。
 *
 * 与 /api/orders/checkout 的区别:金额不来自商品定价,而是用户自填 + 服务端按
 * 币种校验区间并折算到账额度。前端**只能**提交 currency/amount 两个字段,
 * 到账额度(recharge_amount)一律服务端计算后写入,不接受任何客户端 metaData
 * ——这是整个功能的信任边界,详见 utils/topup.ts 与 utils/orderMetaData.ts。
 */
const bodySchema = z.object({
  currency: z.string().min(1).max(8),
  amount: z.number().positive(),
})

// 与 checkout 同口径的粗粒度限流(每 IP 每分钟 5 笔)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>()

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        loginRequired: '请先登录后再充值',
        tooManyRequests: '请求过于频繁，请稍后再试。',
        pendingTitle: '充值订单待支付',
        pendingMessage: (amount: number, currency: string, rechargeAmount: number, accountingCurrency: string) =>
          `您的充值订单已创建，待支付 ${amount} ${currency}，到账 ${rechargeAmount} ${accountingCurrency}。`,
        created: '充值订单创建成功',
      }
    : {
        loginRequired: 'Please log in before topping up',
        tooManyRequests: 'Too many requests. Please try again later.',
        pendingTitle: 'Top-up Payment Pending',
        pendingMessage: (amount: number, currency: string, rechargeAmount: number, accountingCurrency: string) =>
          `Your top-up order has been created. ${amount} ${currency} is pending payment, and ${rechargeAmount} ${accountingCurrency} will be credited after payment.`,
        created: 'Top-up order created successfully',
      }
  // 充值必须落到具体用户:余额按 userId 记在 ainode,访客无处入账
  const session = await requireUserSession(event).catch(() => null)
  const userId = (session?.user as any)?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: messages.loginRequired })
  }

  // session 可能指向已删除用户,直接建单会撞外键
  const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (userExists.length === 0) {
    await clearUserSession(event).catch(() => null)
    throw createError({ statusCode: 401, message: messages.loginRequired })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const now = Date.now()
  const rateData = rateLimitMap.get(ip)
  if (!rateData || rateData.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 })
  } else {
    rateData.count++
    if (rateData.count > 5) {
      throw createError({ statusCode: 429, message: messages.tooManyRequests })
    }
  }

  const parsedBody = bodySchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '充值参数无效' : 'Invalid top-up request',
    })
  }
  const body = parsedBody.data

  const rules = await getTopupRules()
  let quote
  try {
    quote = buildTopupQuote(rules, body.currency, body.amount, locale)
  } catch (error) {
    if (error instanceof TopupValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    throw error
  }

  const carrier = await ensureTopupCarrierProduct()
  const visitorId = ensureVisitorId(event)
  const contactEmail = String((session?.user as any)?.email || '').trim() || `${visitorId}@example.com`

  const promoTracking = mergePromoTracking(
    readPromoTracking(event),
    await capturePromoTracking(event),
  )

  // 全部服务端计算;此处没有任何字段来自请求体
  const orderMetaObj: Record<string, any> = {
    recharge_amount: quote.rechargeAmount,
    balance_type: 'cash',
    display_unit: quote.accountingCurrency,
    topup: {
      currency: quote.currency,
      paidAmount: quote.amount,
      rate: rules.options[quote.currency]?.rate ?? 1,
      accountingCurrency: quote.accountingCurrency,
    },
    ...(promoTracking.inviteCode ? { inviteCode: promoTracking.inviteCode } : {}),
    ...(promoTracking.promoCode ? { promoCode: promoTracking.promoCode } : {}),
    ...(promoTracking.agentCode ? { agentCode: promoTracking.agentCode } : {}),
  }

  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const orderId = `TU${dateStr}${String(Date.now()).slice(-6)}${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  const exchangeRate = quote.rechargeAmount > 0
    ? Math.round((quote.amount / quote.rechargeAmount) * 100000000) / 100000000
    : 1
  const minimalCheckoutConfig = await getMinimalCheckoutAdminConfig()
  const bridgeMeta = buildMinimalCheckoutBridgeMeta({
    externalOrderId: orderId,
    sourceProductId: carrier.id,
    amount: quote.amount,
    currency: quote.currency,
    sourceAmount: quote.rechargeAmount,
    sourceCurrency: quote.accountingCurrency,
    exchangeRate,
    rechargeAmount: quote.rechargeAmount,
    rechargeCurrency: quote.accountingCurrency,
    balanceType: 'cash',
    notifyUrl: minimalCheckoutConfig.defaultNotifyUrl || undefined,
    returnUrl: minimalCheckoutConfig.defaultReturnUrl || undefined,
    cancelUrl: minimalCheckoutConfig.defaultCancelUrl || undefined,
    customerEmail: contactEmail,
    attach: {
      channel: 'qingpu-wallet',
      businessType: 'topup',
      sourceProductId: carrier.id,
      productName: carrier.name,
      productMeta: carrier.metaData,
      userId,
      topupRate: rules.options[quote.currency]?.rate ?? 1,
      topupRateDirection: 'payment_to_recharge',
    },
  })
  const relayOrderMeta = mergeMinimalCheckoutMeta({
    ...orderMetaObj,
    currencySnapshot: {
      baseAmount: quote.rechargeAmount,
      baseCurrency: quote.accountingCurrency,
      amount: quote.amount,
      currency: quote.currency,
      exchangeRate,
      source: 'qingpu-topup-rules',
    },
  }, bridgeMeta)

  await db.insert(orders).values({
    id: orderId,
    productId: carrier.id,
    amount: quote.amount,
    currency: quote.currency,
    source: 'minimal_checkout',
    externalOrderId: orderId,
    status: ORDER_STATUS.NONE,
    payStatus: ORDER_PAY_STATUS.PENDING,
    contactEmail,
    payMethod: 'none',
    visitorId,
    userId,
    metaData: prepareOrderMetaForInsert(relayOrderMeta),
    createdAt: new Date(),
  })

  await createOrderAttribution({
    orderId,
    buyerUserId: userId,
    metaData: relayOrderMeta,
  })

  await trackVisitorEvent(event, {
    visitorId,
    userId,
    orderId,
    productId: carrier.id,
    eventName: 'begin_checkout',
  })

  await createNotification({
    userId,
    visitorId,
    type: 'order_pending',
    title: messages.pendingTitle,
    message: messages.pendingMessage(quote.amount, quote.currency, quote.rechargeAmount, quote.accountingCurrency),
    data: { orderId, payStatus: 'pending', targetPath: `/payment/${orderId}` },
  })

  return {
    code: 0,
    message: messages.created,
    data: {
      id: orderId,
      amount: quote.amount,
      currency: quote.currency,
      rechargeAmount: quote.rechargeAmount,
      accountingCurrency: quote.accountingCurrency,
    },
  }
})
