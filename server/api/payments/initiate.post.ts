import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { getRequestIP } from 'h3'
import { db } from '../../db/runtime'
import { orders, paymentMethods } from '../../db/schema'
import { executeCreateScript } from '../../utils/sandbox'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { requireOrderOwnership } from '../../utils/orderAccess'
import { isPaymentMethodCurrencySupported, resolvePaymentMethodCurrencies } from '../../utils/topup'
import {
  getSiteLocaleConfig,
  isPaymentMethodAvailableForLocale,
  resolveRequestLocale,
} from '../../utils/paymentMethodLocales'
import { getRequestLocale } from '../../utils/requestLocale'
import { reconcileOrder } from '../../utils/orderReconcile'
import { resolvePaymentPluginConfig } from '../../utils/paymentPluginConfig'
import { requireTrustedRequestOrigin } from '../../utils/domainLocale'

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
    const origin = requireTrustedRequestOrigin(event)
    const locale = getRequestLocale(event)
    const messages = locale === 'zh'
      ? {
          invalidPayload: '支付请求参数无效',
          alreadyPaid: '订单已支付',
          methodNotFound: '支付方式不存在或未启用',
          methodUnavailableForLocale: '当前语言下该支付方式不可用',
          createScriptMissing: (code: string) => `支付创建脚本缺失：${code}`,
          currencyMismatch: (methodCurrencies: string, orderCurrency: string) => `该支付方式支持 ${methodCurrencies}，但订单币种为 ${orderCurrency}，请选择支持 ${orderCurrency} 的支付方式。`,
          initiateFailed: '发起支付失败',
          alreadyPaidSynced: '该订单已支付成功，状态已同步',
          initiated: '支付发起成功',
          internalError: '服务器内部错误',
        }
      : {
          invalidPayload: 'Invalid payment request',
          alreadyPaid: 'Order already paid',
          methodNotFound: 'Payment method not found or inactive',
          methodUnavailableForLocale: 'Payment method is not available in current language',
          createScriptMissing: (code: string) => `Create script missing for ${code}`,
          currencyMismatch: (methodCurrencies: string, orderCurrency: string) => `This payment method supports ${methodCurrencies}, but the order is in ${orderCurrency}. Please choose a method that supports ${orderCurrency}.`,
          initiateFailed: 'Failed to initiate payment',
          alreadyPaidSynced: 'This order was already paid; status has been synced',
          initiated: 'Payment initiated successfully',
          internalError: 'Internal server error',
        }
    const parsedBody = bodySchema.safeParse(await readBody(event))
    if (!parsedBody.success) {
      return { code: 1, message: messages.invalidPayload }
    }
    const body = parsedBody.data
    // 归属校验:发起支付会改写订单的 payMethod/tradeNo,只允许订单所有者操作
    const order = await requireOrderOwnership(event, body.orderId)
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      return { code: 1, message: messages.alreadyPaid }
    }

    const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true))
    const method = methods.find((m: any) => String(m.code).toLowerCase() === body.methodCode.toLowerCase())
    if (!method) {
      return { code: 1, message: messages.methodNotFound }
    }

    const localeConfig = await getSiteLocaleConfig()
    const requestLocale = resolveRequestLocale(event, body.locale, localeConfig)
    if (!isPaymentMethodAvailableForLocale(method, requestLocale, localeConfig)) {
      return { code: 1, message: messages.methodUnavailableForLocale }
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
      return { code: 1, message: messages.createScriptMissing(method.code) }
    }

    const configJson = resolvePaymentPluginConfig(method.code, method.configJson)

    // 所有订单都以创建时锁定的币种为准。转换型插件可以同时接受源币种和
    // 结算币种；未声明币种的历史插件继续按兼容模式放行。
    const methodCurrencies = resolvePaymentMethodCurrencies(configJson)
    const orderCurrency = String((order as any).currency || '').trim().toUpperCase()
    if (orderCurrency && !isPaymentMethodCurrencySupported(configJson, orderCurrency)) {
      return {
        code: 1,
        message: messages.currencyMismatch(methodCurrencies.join(' / '), orderCurrency),
      }
    }

    const callbackUrl = `${origin}/api/webhooks/${order.id}`
    const returnUrl = body.returnUrl || body.successUrl || `${origin}/callback/${order.id}`
    const cancelUrl = body.cancelUrl || `${origin}/callback/cancel?orderId=${order.id}`
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket.remoteAddress || ''
    const requestHeaders = getRequestHeaders(event)
    let orderMetaData: Record<string, any> = {}
    try {
      const parsedMetaData = typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
      if (parsedMetaData && typeof parsedMetaData === 'object' && !Array.isArray(parsedMetaData)) {
        orderMetaData = parsedMetaData
      }
    } catch {}

    const result = await executeCreateScript(createScript, {
      order: {
        id: order.id,
        amount: order.amount,
        currency: orderCurrency,
        productId: order.productId,
        contactEmail: order.contactEmail,
        metaData: {
          ...orderMetaData,
          currency: orderCurrency,
        },
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
      // 下单失败最常见的一种情况是这笔单其实已经付过了(微信返回 ORDERPAID
      // /「订单已支付」),而回调没送达或验签失败,本地还停在未支付。此时直接把
      // 失败抛给用户会让订单永远卡住,只能人工改状态。所以先向网关查一次真实
      // 状态——只认网关的回答,查到已支付就补置账 + 履约。
      //
      // 订单上此刻还没有 payMethod(下面才写),先补上再查,否则 reconcileOrder
      // 不知道该问哪个网关。
      await db.update(orders)
        .set({ payMethod: method.code })
        .where(and(eq(orders.id, order.id), ne(orders.payStatus, ORDER_PAY_STATUS.PAID)))

      const reconciled = await reconcileOrder(order.id, 'initiate-retry')
      if (reconciled.outcome === 'paid' || reconciled.outcome === 'already_paid') {
        return {
          code: 0,
          message: messages.alreadyPaidSynced,
          data: { alreadyPaid: true, tradeNo: reconciled.tradeNo },
        }
      }

      return { code: 1, message: result.message || messages.initiateFailed }
    }
    const updateData: any = { payMethod: method.code }
    if (result.tradeNo) updateData.tradeNo = result.tradeNo
    await db.update(orders).set(updateData).where(eq(orders.id, order.id))

    return {
      code: 0,
      message: messages.initiated,
      data: {
        paymentUrl: result.paymentUrl,
        qrCodeText: result.qrCodeText,
        tradeType: result.tradeType,
        tradeNo: result.tradeNo
      }
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    const locale = getRequestLocale(event)
    return { code: 1, message: error?.message || (locale === 'zh' ? '服务器内部错误' : 'Internal server error') }
  }
})
