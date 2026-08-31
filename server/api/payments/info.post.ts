import { orders, paymentMethods } from "../../db/schema"
import { and, eq } from "drizzle-orm"
import fs from 'fs'
import path from 'path'
import { db } from '../../db/runtime'
import { requireOrderOwnership } from '../../utils/orderAccess'
import { applyLocalPaymentPluginDefaults } from '../../../payments/meta'
import {
  getSiteLocaleConfig,
  isPaymentMethodAvailableForLocale,
  resolveRequestLocale,
} from '../../utils/paymentMethodLocales'
import { getRequestLocale } from '../../utils/requestLocale'
import { isPaymentMethodCurrencySupported } from '../../utils/topup'
import { resolvePaymentPluginConfig } from '../../utils/paymentPluginConfig'
import { lockLegacyPendingOrderCurrency } from '../../utils/legacyPendingOrders'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        orderIdRequired: '订单 ID 不能为空',
        noActiveMethods: '当前没有可用的支付方式',
        emptyContent: '所有启用支付方式的支付说明内容均为空',
        currencyUnsupported: (currency: string) => `当前没有支持 ${currency} 结算的支付方式`,
        internalError: '服务器内部错误',
      }
    : {
        orderIdRequired: 'Order ID is required',
        noActiveMethods: 'No active payment methods available',
        emptyContent: 'Payment info content is empty for all active methods',
        currencyUnsupported: (currency: string) => `No payment method supports ${currency} settlement`,
        internalError: 'Internal server error',
      }
  try {
    const body = await readBody(event)
    const { orderId, locale: inputLocale } = body
    
    if (!orderId) {
      return { code: 1, message: messages.orderIdRequired }
    }

    // 1. 归属校验后获取订单——支付信息含金额与收款内容,只允许订单所有者查看
    let order = await requireOrderOwnership(event, String(orderId))
    const localeConfig = await getSiteLocaleConfig()
    const requestLocale = resolveRequestLocale(event, inputLocale, localeConfig)
    order = await lockLegacyPendingOrderCurrency(order, requestLocale)
    
    // 2. 获取所有激活的支付方式
    let activeMethods = (await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true)))
      .map((method: any) => applyLocalPaymentPluginDefaults({ ...method }))

    const localeFilteredMethods = activeMethods.filter((method: any) => isPaymentMethodAvailableForLocale(method, requestLocale, localeConfig))
    if (localeFilteredMethods.length > 0) {
      activeMethods = localeFilteredMethods
    }
    if (activeMethods.length === 0) {
      return { code: 1, message: messages.noActiveMethods }
    }

    // 3. 组合所有激活支付方式的 HTML
    const availableMethods = []
    let currencyMismatchCount = 0
    let currencyCompatibleCount = 0

    for (const method of activeMethods) {
      const methodCode = method.code
      let rawHtml = ''
      const configObj = resolvePaymentPluginConfig(methodCode, method.configJson)

      const orderCurrency = String((order as any).currency || 'USD').trim().toUpperCase()
      if (!isPaymentMethodCurrencySupported(configObj, orderCurrency)) {
        currencyMismatchCount++
        continue
      }
      currencyCompatibleCount++
      
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
      content = content.replace(/\{\$currency\}/g, String((order as any).currency || 'USD'))
      content = content.replace(/\{\$productId\}/g, order.productId.toString())
      
      // Replace custom config variables
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
      if (currencyCompatibleCount === 0 && currencyMismatchCount > 0) {
        return { code: 1, message: messages.currencyUnsupported(String((order as any).currency || 'USD')) }
      }
      return { code: 1, message: messages.emptyContent }
    }

    // 兼容以前的单支付方式逻辑：如果只有一个，或者为了兼容旧版本前端，依然暴露 content 字段
    const combinedContent = availableMethods.map(m => m.content).join('\n')

    return {
      code: 0,
      data: {
        methods: availableMethods,
        amount: order.amount,
        currency: String((order as any).currency || 'USD'),
        content: combinedContent // 保留这个字段，确保旧版 UI / 其它地方调用不报错
      }
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    return { code: 1, message: error.message || messages.internalError }
  }
})
