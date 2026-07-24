import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getRequestIP } from 'h3'
import { db } from '../../db/runtime'
import { orders, paymentMethods } from '../../db/schema'
import { executeCreateScript } from '../../utils/sandbox'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { requireOrderOwnership } from '../../utils/orderAccess'
import { resolvePaymentMethodCurrency } from '../../utils/topup'
import {
  getSiteLocaleConfig,
  isPaymentMethodAvailableForLocale,
  resolveRequestLocale,
} from '../../utils/paymentMethodLocales'

const bodySchema = z.object({
  orderId: z.string().min(1),
  methodCode: z.string().min(1),
  locale: z.string().min(1).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  successUrl: z.string().url().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const body = bodySchema.parse(await readBody(event))
    // 归属校验:发起支付会改写订单的 payMethod/tradeNo,只允许订单所有者操作
    const order = await requireOrderOwnership(event, body.orderId)
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      return { code: 1, message: 'Order already paid' }
    }

    const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true))
    const method = methods.find((m: any) => String(m.code).toLowerCase() === body.methodCode.toLowerCase())
    if (!method) {
      return { code: 1, message: 'Payment method not found or inactive' }
    }

    const localeConfig = await getSiteLocaleConfig()
    const requestLocale = resolveRequestLocale(event, body.locale, localeConfig)
    if (!isPaymentMethodAvailableForLocale(method, requestLocale, localeConfig)) {
      return { code: 1, message: 'Payment method is not available in current language' }
    }

    let createScript = method.create || ''
    if (!createScript.trim()) {
      const localCreateScriptPath = path.join(process.cwd(), 'payments', method.code, 'create.js')
      const localCreateScriptLowerPath = path.join(process.cwd(), 'payments', String(method.code).toLowerCase(), 'create.js')
      if (fs.existsSync(localCreateScriptPath)) {
        createScript = fs.readFileSync(localCreateScriptPath, 'utf-8')
      } else if (fs.existsSync(localCreateScriptLowerPath)) {
        createScript = fs.readFileSync(localCreateScriptLowerPath, 'utf-8')
      }
    }
    if (!createScript.trim()) {
      return { code: 1, message: `Create script missing for ${method.code}` }
    }

    let configJson: Record<string, any> = {}
    try {
      if (method.configJson) {
        configJson = JSON.parse(method.configJson)
      }
    } catch {}

    if (!Object.keys(configJson).length) {
      const localConfigPath = path.join(process.cwd(), 'payments', method.code, 'config.json')
      const localConfigLowerPath = path.join(process.cwd(), 'payments', String(method.code).toLowerCase(), 'config.json')
      try {
        if (fs.existsSync(localConfigPath)) {
          configJson = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'))
        } else if (fs.existsSync(localConfigLowerPath)) {
          configJson = JSON.parse(fs.readFileSync(localConfigLowerPath, 'utf-8'))
        }
      } catch {}
    }

    // 充值订单币种守卫:充值单的 amount 是用户自填的原币金额,若拿去给一个
    // 结算币种不同的网关(如 CNY 单走 Stripe),会按同一个数字扣成美元。
    // 仅作用于充值订单(metaData.topup),且只在能确定插件币种时才拦——普通
    // 商品下单与未声明币种的插件行为保持不变。
    let orderMetaObj: any = null
    try {
      orderMetaObj = typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
    } catch {}
    if (orderMetaObj?.topup) {
      const methodCurrency = resolvePaymentMethodCurrency(configJson)
      const orderCurrency = String((order as any).currency || '').trim().toUpperCase()
      if (methodCurrency && orderCurrency && methodCurrency !== orderCurrency) {
        return {
          code: 1,
          message: `This payment method settles in ${methodCurrency}, but the top-up order is in ${orderCurrency}. Please choose a ${orderCurrency} method.`,
        }
      }
    }

    const requestURL = getRequestURL(event)
    const origin = `${requestURL.protocol}//${requestURL.host}`
    const callbackUrl = `${origin}/api/webhooks/${order.id}`
    const returnUrl = body.returnUrl || body.successUrl || `${origin}/callback/${order.id}`
    const cancelUrl = body.cancelUrl || `${origin}/callback/cancel?orderId=${order.id}`
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket.remoteAddress || ''
    const requestHeaders = getRequestHeaders(event)

    const result = await executeCreateScript(createScript, {
      order: {
        id: order.id,
        amount: order.amount,
        productId: order.productId,
        contactEmail: order.contactEmail,
        metaData: typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
      },
      input: body,
      request: {
        clientIp,
        userAgent: requestHeaders['user-agent'] || '',
        headers: requestHeaders,
      },
      callbackUrl,
      returnUrl,
      cancelUrl
    }, configJson)
    if (!result.ok || (!result.paymentUrl && !result.qrCodeText)) {
      return { code: 1, message: result.message || 'Failed to initiate payment' }
    }
    const updateData: any = { payMethod: method.code }
    if (result.tradeNo) updateData.tradeNo = result.tradeNo
    await db.update(orders).set(updateData).where(eq(orders.id, order.id))

    return {
      code: 0,
      message: 'Payment initiated successfully',
      data: {
        paymentUrl: result.paymentUrl,
        qrCodeText: result.qrCodeText,
        tradeType: result.tradeType,
        tradeNo: result.tradeNo
      }
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    return { code: 1, message: error?.message || 'Internal server error' }
  }
})
