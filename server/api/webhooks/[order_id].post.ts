import { paymentMethods, orders } from "../../db/schema"
import { and, eq, ne } from "drizzle-orm"
import { getAffectedRows } from "../../utils/dbResult"
import { executeCallbackScript } from "../../utils/sandbox"
import { fulfillOrder } from "../../utils/fulfillment"
import { markOrderPaid } from "../../utils/orderPayment"
import { logger } from "../../utils/logger"
import { trackVisitorEvent } from "../../utils/visitorAnalytics"
import { createOrderAttribution, settlePromoCommission } from "../../promo/service"
import fs from 'fs'
import path from 'path'
import { db } from '../../db/runtime'
import { ORDER_PAY_STATUS,ORDER_STATUS } from '../../utils/constants'
import { readRawBody, readBody } from 'h3'
import { getRequestLocale } from '../../utils/requestLocale'
import { markTopupPaymentFailed } from '../../utils/topupLedger'

// 写日志时对回调 payload 脱敏:授权/签名类头域打码,rawBody 只留长度(防签名
// 与 PII 落库)。query/urlOrderId 保留供排查
const SENSITIVE_HEADER_KEYS = new Set([
  'authorization', 'x-api-key', 'apikey', 'cookie', 'signature', 'x-signature',
  'sign', 'x-sign', 'token', 'x-token', 'secret',
])
function sanitizePayloadForLog(payload: { body: any; rawBody: string; query: any; headers: Record<string, any>; urlOrderId: any }) {
  const maskedHeaders: Record<string, any> = {}
  for (const [key, value] of Object.entries(payload.headers || {})) {
    maskedHeaders[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '***redacted***' : value
  }
  return {
    urlOrderId: payload.urlOrderId,
    query: payload.query,
    headers: maskedHeaders,
    rawBodyLength: (payload.rawBody || '').length,
  }
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const urlOrderId = getRouterParam(event, 'order_id')
 
  let rawBody = ''
  let body = {}
  try {
    rawBody = await readRawBody(event) || ''
    if (rawBody) {
      body = JSON.parse(rawBody)
    }
  } catch (e) {
    try {
      body = await readBody(event) || {}
    } catch (err) {}
  }

  const query = getQuery(event)
  const headers = getRequestHeaders(event)
  const payload = { body, rawBody, query, headers, urlOrderId }

  // 日志脱敏:payload 含回调 headers(签名/授权头)与 body(可能带 PII/卡密),
  // 生产日志不落原文。敏感头整体打码,rawBody 只留长度,写日志一律用此副本。
  const logPayload = sanitizePayloadForLog(payload)

  await logger.warn(`record webhook for order ${urlOrderId}`, { 
      source: 'webhook', 
      details: { urlOrderId, payload: logPayload } 
    })
  
  if (!urlOrderId) {
    return createError({
      statusCode: 400,
      message: locale === 'zh' ? 'Webhook URL 中缺少订单 ID' : 'Order ID is required in webhook URL',
    })
  }

  try {
    // 1. Fetch the order to find out which payment method was used
    const existingOrders = await db.select().from(orders).where(eq(orders.id, urlOrderId))
    if (existingOrders.length === 0) {
      throw new Error(`Order ${urlOrderId} not found`)
    }
    const order = existingOrders[0]

    // 查询订房是否已完成支付
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      await markOrderPaid({ orderId: order.id, source: 'webhook-retry' })
      return "success"
    }
    
    const payMethod = order.payMethod
    if (!payMethod) {
      throw new Error(`Order ${urlOrderId} does not have a payment method assigned`)
    }

    // 2. Fetch the payment method configuration
    // 大小写不敏感查询，因为订单里存的是小写 gtipay，而支付方式表里可能是 GtiPay 或者其他大小写形式
    const methods = await db.select()
      .from(paymentMethods)
      // 注意：由于 SQLite LIKE 默认是大小写不敏感的，这里可以使用 sql 操作符来实现大小写不敏感匹配，
      // 但更稳妥且不依赖外部插件的做法是在查询出来后在内存中进行查找，或者先查出所有激活的再过滤。
      // 因为系统支付方式不会太多，这里我们查出所有，再在代码里做大小写不敏感对比：
      
    const allMethods = await db.select().from(paymentMethods)
    const method = allMethods.find((m: any) => m.code.toLowerCase() === payMethod.toLowerCase() && m.isActive)

    if (!method) {
      throw new Error(`Payment method ${payMethod} is not found or inactive`)
    }
    
    // 把真实的大小写正确的 code 拿出来，用于后续查找本地文件目录
    const realMethodCode = method.code
    
    let callbackScript = method.callback || ''
    if (!callbackScript.trim()) {
      const localScriptPath = path.join(process.cwd(), 'payments', realMethodCode, 'callback.js')
      const lowerCaseLocalScriptPath = path.join(process.cwd(), 'payments', realMethodCode.toLowerCase(), 'callback.js')
      try {
        if (fs.existsSync(localScriptPath)) {
          console.log(`[Webhook] Using local script: ${localScriptPath}`)
          callbackScript = fs.readFileSync(localScriptPath, 'utf-8')
        } else if (fs.existsSync(lowerCaseLocalScriptPath)) {
          console.log(`[Webhook] Using local script (lowercase fallback): ${lowerCaseLocalScriptPath}`)
          callbackScript = fs.readFileSync(lowerCaseLocalScriptPath, 'utf-8')
        }
      } catch (err) {
        console.warn(`Failed to read local callback.js for ${realMethodCode}`, err)
      }
    }

    if (!callbackScript || callbackScript.trim() === '') {
      throw new Error(`Payment method ${realMethodCode} does not have a webhook callback script configured`)
    }

   
    // Parse the config JSON (which contains secrets)
    let configJson = {}
    try {
      configJson = method.configJson ? JSON.parse(method.configJson) : {}
    } catch (e) {
      console.warn("Failed to parse configJson for", realMethodCode)
    }
    if (!Object.keys(configJson as any).length) {
      const localConfigPath = path.join(process.cwd(), 'payments', realMethodCode, 'config.json')
      const localConfigLowerPath = path.join(process.cwd(), 'payments', realMethodCode.toLowerCase(), 'config.json')
      try {
        if (fs.existsSync(localConfigPath)) {
          configJson = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'))
        } else if (fs.existsSync(localConfigLowerPath)) {
          configJson = JSON.parse(fs.readFileSync(localConfigLowerPath, 'utf-8'))
        }
      } catch (e) {
        console.warn("Failed to read local config.json for", realMethodCode)
      }
    }

    // 3. Execute Sandbox
    const result = await executeCallbackScript(callbackScript, payload, configJson)

  
    await logger.info(`Webhook processed for ${realMethodCode}`, { 
      source: 'webhook', 
      details: { urlOrderId, payload: logPayload, result } 
    })

    // 4. Handle Result
    if (!result.isSignValid) {
      console.error(`[Webhook] Invalid signature for ${realMethodCode}, Order: ${result.orderId}`)
      await logger.error(`Invalid webhook signature for ${realMethodCode}`, { 
        source: 'webhook', 
        details: { urlOrderId, payload: logPayload, result } 
      })
      setResponseStatus(event, 403)
      return "Invalid Signature"
    }

    // 5. Update Order
    // 越权防线:result.orderId 来自支付脚本返回值,必须与 URL 上的订单号一致。
    // 否则签名有效的脚本可返回任意订单号,把别人的订单顶成已支付并触发履约/佣金。
    if (result.orderId && String(result.orderId) !== String(urlOrderId)) {
      await logger.error(`Webhook orderId mismatch: url=${urlOrderId} script=${result.orderId}`, {
        source: 'webhook',
        details: { urlOrderId, scriptOrderId: result.orderId, method: realMethodCode }
      })
      setResponseStatus(event, 400)
      return "Order ID mismatch"
    }

    if (result.orderId) {
      const existingOrders = await db.select().from(orders).where(eq(orders.id, result.orderId))
      
      if (existingOrders.length > 0) {
        const order = existingOrders[0]
        
        // 置为已支付 + 履约走共享路径(server/utils/orderPayment.ts),
        // 与主动查单补偿是同一份实现,金额校验/原子抢占/履约链都在里面。
        if (result.status === 'paid') {
          const marked = await markOrderPaid({
            orderId: result.orderId,
            tradeNo: result.tradeNo,
            amount: result.amount,
            payMethod: realMethodCode,
            source: 'webhook',
          })
          if (marked.outcome === 'amount_mismatch') {
            await logger.warn(`Amount mismatch for order ${order.id}`, {
              source: 'webhook',
              details: { expected: order.amount, got: result.amount, payload: logPayload, result },
            })
            return "Amount Mismatch"
          }
        } else if (result.status === 'failed' && order.payStatus !== ORDER_PAY_STATUS.PAID) {
          await logger.warn(`Order ${order.id} failed via ${realMethodCode}`, { 
            source: 'webhook', 
            details: { tradeNo: result.tradeNo, amount: result.amount } 
          })
          const updateData: any = {
            payStatus: ORDER_PAY_STATUS.FAILED,
            status: ORDER_STATUS.FAILED, // Keep them in sync for failure
            payMethod: realMethodCode
          }
          if (result.tradeNo) updateData.tradeNo = result.tradeNo

          // 条件更新:失败回调不得覆盖已支付订单(乱序/迟到的失败推送)
          const failedUpdate = await db.update(orders)
            .set(updateData)
            .where(and(eq(orders.id, result.orderId), ne(orders.payStatus, ORDER_PAY_STATUS.PAID)))
          if (getAffectedRows(failedUpdate) > 0) {
            await markTopupPaymentFailed(order.id, `支付网关 ${realMethodCode} 返回失败`)
          }
        }
      } else {
        await logger.error(`Order ${result.orderId} not found in database`, { 
          source: 'webhook', 
          details: { payload: logPayload, result } 
        })
      }
    }

    // 6. Return the gateway-specific success string
    if (typeof result.responseBody === 'object') {
      return result.responseBody
    } else {
      setHeader(event, 'Content-Type', 'text/plain')
      return result.responseBody || 'success'
    }

  } catch (error: any) {
    await logger.error(`Webhook execution error`, { 
      source: 'webhook', 
      details: { urlOrderId, error: error.message, stack: error.stack } 
    })
    setResponseStatus(event, 500)
    return `Webhook Processing Error: ${error.message}`
  }
})
