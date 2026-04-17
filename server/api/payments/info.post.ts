import { paymentMethods, orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import fs from 'fs'
import path from 'path'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { orderId } = body
    
    if (!orderId) {
      return { code: 1, message: "Order ID is required" }
    }

    // 1. 获取订单，确定金额等信息
    const orderList = await db.select().from(orders).where(eq(orders.id, orderId))
    if (orderList.length === 0) {
      return { code: 1, message: "Order not found" }
    }
    const order = orderList[0]
    
    // 2. 获取所有激活的支付方式
    const activeMethods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true))
    if (activeMethods.length === 0) {
      return { code: 1, message: "No active payment methods available" }
    }

    // 3. 组合所有激活支付方式的 HTML
    const availableMethods = []

    for (const method of activeMethods) {
      const methodCode = method.code
      let rawHtml = ''
      
      rawHtml = method.info || ''
      if (!rawHtml.trim()) {
        const localFilePath = path.join(process.cwd(), 'payments', methodCode, 'info.html')
        const localFileLowerPath = path.join(process.cwd(), 'payments', String(methodCode).toLowerCase(), 'info.html')
        try {
          if (fs.existsSync(localFilePath)) {
            rawHtml = fs.readFileSync(localFilePath, 'utf-8')
          } else if (fs.existsSync(localFileLowerPath)) {
            rawHtml = fs.readFileSync(localFileLowerPath, 'utf-8')
          }
        } catch (err) {
          console.warn(`Failed to read local info.html for ${methodCode}`, err)
        }
      }

      if (!rawHtml) continue;

      // 4. 变量替换逻辑
      let content = rawHtml.replace(/\{\$orderId\}/g, orderId)
      content = content.replace(/\{\$amount\}/g, order.amount.toString())
      content = content.replace(/\{\$productId\}/g, order.productId.toString())
      
      // Replace custom config variables
      let configObj = {}
      try {
        if (method.configJson) {
          configObj = JSON.parse(method.configJson)
        }
      } catch (e) {
        // ignore JSON parse error
      }
      
      for (const [key, value] of Object.entries(configObj)) {
        const regex = new RegExp(`\\{\\$config\\.${key}\\}`, 'g')
        content = content.replace(regex, String(value))
      }

      availableMethods.push({
        code: method.code,
        name: method.name,
        iconUrl: method.iconUrl,
        content: content
      })
    }

    if (availableMethods.length === 0) {
      return { code: 1, message: "Payment info content is empty for all active methods" }
    }

    // 兼容以前的单支付方式逻辑：如果只有一个，或者为了兼容旧版本前端，依然暴露 content 字段
    const combinedContent = availableMethods.map(m => m.content).join('\n')

    return {
      code: 0,
      data: {
        methods: availableMethods,
        content: combinedContent // 保留这个字段，确保旧版 UI / 其它地方调用不报错
      }
    }
  } catch (error: any) {
    return { code: 1, message: error.message || "Internal server error" }
  }
})
