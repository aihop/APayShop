import { paymentMethods, orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { executeCallbackScript } from "../../utils/sandbox"
import { dispatchEvent } from "../../utils/eventBus"
import { fulfillOrder } from "../../utils/fulfillment"
import { logger } from "../../utils/logger"
import { trackVisitorEvent } from "../../utils/visitorAnalytics"
import fs from 'fs'
import path from 'path'
import { db } from '@nuxthub/db'
import { ORDER_PAY_STATUS,ORDER_STATUS } from '../../utils/constants'
import { readRawBody, readBody } from 'h3'

export default defineEventHandler(async (event) => {
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

  await logger.warn(`record webhook for order ${urlOrderId}`, { 
      source: 'webhook', 
      details: { urlOrderId, payload } 
    })
  
  if (!urlOrderId) {
    return createError({ statusCode: 400, message: "Order ID is required in webhook URL" })
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
      details: { urlOrderId, payload, result } 
    })

    // 4. Handle Result
    if (!result.isSignValid) {
      console.error(`[Webhook] Invalid signature for ${realMethodCode}, Order: ${result.orderId}`)
      await logger.error(`Invalid webhook signature for ${realMethodCode}`, { 
        source: 'webhook', 
        details: { urlOrderId, payload, result } 
      })
      setResponseStatus(event, 403)
      return "Invalid Signature"
    }

    // 5. Update Order
    if (result.orderId) {
      const existingOrders = await db.select().from(orders).where(eq(orders.id, result.orderId))
      
      if (existingOrders.length > 0) {
        const order = existingOrders[0]
        
        // Optional: verify amount matches
        if (result.amount && Math.abs(order.amount - result.amount) > 0.01) {
          await logger.warn(`Amount mismatch for order ${order.id}`, { 
            source: 'webhook', 
            details: { expected: order.amount, got: result.amount, payload, result } 
          })
          
          await db.update(orders)
            .set({ tradeNo: result.tradeNo })
            .where(eq(orders.id, result.orderId))
            
          return "Amount Mismatch"
        }

        // Update order status if paid or failed
        if (result.status === 'paid' && order.payStatus !== ORDER_PAY_STATUS.PAID) {
          await logger.info(`Order ${order.id} paid via ${realMethodCode}`, { 
            source: 'webhook', 
            details: { tradeNo: result.tradeNo, amount: result.amount } 
          })

          const updateData: any = {
            payStatus: ORDER_PAY_STATUS.PAID,
            status: ORDER_STATUS.PROCESSING, // Temporarily set fulfillment to paid, fulfillment logic will update it further
            payMethod: realMethodCode,
            paidAt: new Date()
          }
          if (result.tradeNo) updateData.tradeNo = result.tradeNo

          await db.update(orders)
            .set(updateData)
            .where(eq(orders.id, result.orderId))

          await trackVisitorEvent(null, {
            visitorId: order.visitorId,
            userId: order.userId,
            orderId: order.id,
            productId: order.productId,
            eventName: 'order_paid',
            createdAt: updateData.paidAt,
          })
            
          // Trigger delivery logic here
          const fulfilledOrder = await fulfillOrder(result.orderId)
          if (fulfilledOrder) {
             dispatchEvent('order.paid', fulfilledOrder)
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

          await db.update(orders)
            .set(updateData)
            .where(eq(orders.id, result.orderId))
        }
      } else {
        await logger.error(`Order ${result.orderId} not found in database`, { 
          source: 'webhook', 
          details: { payload, result } 
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
