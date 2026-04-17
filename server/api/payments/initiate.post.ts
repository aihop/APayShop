import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { orders, paymentMethods } from '../../db/schema'
import { executeCreateScript } from '../../utils/sandbox'
import { ORDER_PAY_STATUS } from '../../utils/constants'

const bodySchema = z.object({
  orderId: z.string().min(1),
  methodCode: z.string().min(1),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  successUrl: z.string().url().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const body = bodySchema.parse(await readBody(event))
    const orderRows = await db.select().from(orders).where(eq(orders.id, body.orderId)).limit(1)
    if (!orderRows.length || !orderRows[0]) {
      return { code: 1, message: 'Order not found' }
    }
    const order = orderRows[0]
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      return { code: 1, message: 'Order already paid' }
    }

    const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true))
    const method = methods.find((m: any) => String(m.code).toLowerCase() === body.methodCode.toLowerCase())
    if (!method) {
      return { code: 1, message: 'Payment method not found or inactive' }
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

    const requestURL = getRequestURL(event)
    const origin = `${requestURL.protocol}//${requestURL.host}`
    const callbackUrl = `${origin}/api/webhooks/${order.id}`
    const returnUrl = body.returnUrl || body.successUrl || `${origin}/callback/${order.id}`
    const cancelUrl = body.cancelUrl || `${origin}/callback/cancel?orderId=${order.id}`

    const result = await executeCreateScript(createScript, {
      order: {
        id: order.id,
        amount: order.amount,
        productId: order.productId,
        contactEmail: order.contactEmail,
        metaData: typeof order.metaData === 'string' ? JSON.parse(order.metaData) : order.metaData
      },
      input: body,
      callbackUrl,
      returnUrl,
      cancelUrl
    }, configJson)
    if (!result.ok || !result.paymentUrl) {
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
        tradeNo: result.tradeNo
      }
    }
  } catch (error: any) {
    return { code: 1, message: error?.message || 'Internal server error' }
  }
})
