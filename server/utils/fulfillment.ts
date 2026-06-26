import { orders, products, cards, subscriptions } from "../db/schema"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"
import { db } from '../db/runtime'


export async function fulfillOrder(orderId: string) {
  // 1. Get Order
  const orderRes = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!orderRes.length) return false
  const order = orderRes[0]
  const orderMeta = normalizeMetaData(order.metaData)
  
  // 2. Get Product
  const productRes = await db.select().from(products).where(eq(products.id, order.productId)).limit(1)
  if (!productRes.length) return false
  const product = productRes[0]
  
  let deliveryInfo = product.resource || ""
  let newStatus = "delivered"
  
  // Parse Product MetaData
  let productMeta = {}
  if (product.metaData) {
    try {
      productMeta = typeof product.metaData === 'string' ? JSON.parse(product.metaData) : product.metaData
    } catch (e) {}
  }
  productMeta = normalizeMetaData(productMeta)

  // 3. Process by Type
  switch (product.type) {
    case 'key': {
      const cardRes = await db.select().from(cards).where(and(eq(cards.productId, product.id), eq(cards.isUsed, false))).limit(1)
      if (cardRes.length) {
        const card = cardRes[0]
        deliveryInfo = card.cardNumber
        await db.update(cards).set({ isUsed: true, orderId }).where(eq(cards.id, card.id))
      } else {
        deliveryInfo = "Pending manual delivery (Out of stock)"
        newStatus = "processing" // Need manual intervention
      }
      break
    }
    case 'file': {
      deliveryInfo = product.resource || "Download link will be provided soon."
      break
    }
    case 'subscription': {
      newStatus = "active"
      deliveryInfo = `Subscription active. Duration: ${(productMeta as any).subscription_cycle || 'Unknown'}`
      
      // Parse interval and intervalCount
      // subscription_cycle format: "1_month", "1_year"
      let interval = 'month'
      let intervalCount = 1
      if (productMeta && (productMeta as any).subscription_cycle) {
        const parts = String((productMeta as any).subscription_cycle).split('_')
        if (parts.length === 2) {
          intervalCount = parseInt(parts[0]) || 1
          interval = parts[1]
        }
      }
      
      // Calculate period end
      const startDate = new Date()
      const endDate = new Date(startDate)
      if (interval === 'month') endDate.setMonth(endDate.getMonth() + intervalCount)
      else if (interval === 'year') endDate.setFullYear(endDate.getFullYear() + intervalCount)
      else if (interval === 'day') endDate.setDate(endDate.getDate() + intervalCount)
      else if (interval === 'week') endDate.setDate(endDate.getDate() + (intervalCount * 7))

      // Determine Subscription ID
      // If it's a recurring payment, webhook should have set order.subscriptionId or we can extract it from tradeNo if we have a pattern.
      // Usually the gateway returns a sub_xxx ID. If we don't have one, generate an internal one for fixed-term subscriptions.
      const subId = order.subscriptionId || crypto.randomUUID()
      
      // Upsert into subscriptions table
      const existingSub = await db.select().from(subscriptions).where(eq(subscriptions.id, subId)).limit(1)
      if (existingSub.length > 0) {
         // It's a renewal, update the end date
         await db.update(subscriptions).set({
           currentPeriodEnd: endDate,
           status: 'active',
           updatedAt: new Date()
         }).where(eq(subscriptions.id, subId))
      } else {
         // Create new subscription record
         await db.insert(subscriptions).values({
           id: subId,
           gatewaySubId: order.tradeNo || null, // Best guess if not provided
           userId: order.userId || null,
           productId: product.id,
           payMethod: order.payMethod || 'unknown',
           status: 'active',
           interval,
           intervalCount,
           amount: order.amount,
           currency: 'USD', // Could be dynamic if you support multi-currency
           currentPeriodStart: startDate,
           currentPeriodEnd: endDate,
           createdAt: new Date()
         })
      }
      
      // Ensure order is linked to this subscription
      if (!order.subscriptionId) {
         await db.update(orders).set({ subscriptionId: subId }).where(eq(orders.id, order.id))
         order.subscriptionId = subId
      }
      
      break
    }
    case 'service': {
      newStatus = "processing"
      deliveryInfo = "Service order received. Our team will contact you shortly."
      break
    }
    case 'topup': {
      const rechargeAmount = firstPositiveNumber(
        (productMeta as any).recharge_amount,
        order.amount,
      )
      const unit = String((productMeta as any).display_unit || 'credits').trim()
      deliveryInfo = (productMeta as any).delivery_message
        || `Top-up payment confirmed. ${rechargeAmount} ${unit} will be credited to your account.`
      break
    }
    default: {
      deliveryInfo = "Order confirmed."
    }
  }
  
  // 4. Update Order
  await db.update(orders).set({
    status: newStatus,
    deliveryInfo
  }).where(eq(orders.id, orderId))
  
  return {
    ...order,
    metaData: orderMeta,
    status: newStatus,
    deliveryInfo,
    product: {
      id: product.id,
      slug: product.slug || '',
      name: product.name,
      type: product.type,
      price: product.price,
      metaData: productMeta,
    },
    integration: buildOrderIntegration({
      orderId: order.id,
      orderAmount: order.amount,
      productName: product.name,
      productType: product.type,
      orderMeta,
      productMeta,
    }),
  }
}

function normalizeMetaData(value: any) {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (typeof value === 'object') {
    return value
  }
  return {}
}

function buildOrderIntegration(input: {
  orderId: string
  orderAmount: number
  productName: string
  productType: string
  orderMeta: Record<string, any>
  productMeta: Record<string, any>
}) {
  const productTx = normalizeMetaData(input.productMeta?.integration)?.transaction || {}
  const orderTx = normalizeMetaData(input.orderMeta?.integration)?.transaction || {}
  const txConfig = {
    ...productTx,
    ...orderTx,
  }

  const hasPlanIds = Array.isArray(input.productMeta?.plan_ids) && input.productMeta.plan_ids.length > 0
  const explicitEnabled = typeof txConfig.enabled === 'boolean' ? txConfig.enabled : undefined

  let type = String(txConfig.type || '').trim().toLowerCase()
  let balanceType = String(
    txConfig.balance_type
      || input.orderMeta?.balance_type
      || input.productMeta?.balance_type
      || '',
  ).trim().toLowerCase()

  if (!type && (hasPlanIds || input.productType === 'subscription')) {
    type = 'grant_issue'
  } else if (!type && (input.productType === 'topup' || balanceType)) {
    type = 'topup'
  }

  if (!balanceType) {
    if (type === 'grant_issue' || hasPlanIds || input.productType === 'subscription') {
      balanceType = 'grant'
    } else if (type === 'topup' || input.productType === 'topup') {
      balanceType = 'cash'
    }
  }

  const amount = firstPositiveNumber(
    txConfig.amount,
    input.orderMeta?.recharge_amount,
    input.productMeta?.recharge_amount,
    input.orderAmount,
  )

  const enabled = explicitEnabled ?? Boolean(type && balanceType && amount > 0)

  return {
    transaction: {
      enabled,
      type,
      balance_type: balanceType,
      direction: String(txConfig.direction || 'credit').trim().toLowerCase(),
      amount,
      source_id: String(txConfig.source_id || input.orderId),
      remark: String(txConfig.remark || `${input.productName} order paid`).trim(),
      metadata: {
        order_id: input.orderId,
        product_type: input.productType,
        plan_ids: hasPlanIds ? input.productMeta.plan_ids : undefined,
      },
    },
  }
}

function firstPositiveNumber(...values: any[]) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 0
}
