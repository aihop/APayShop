import { orders, products, cards, apiKeys, subscriptions } from "../db/schema"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"
import { db } from '@nuxthub/db'


export async function fulfillOrder(orderId: string) {
  // 1. Get Order
  const orderRes = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!orderRes.length) return false
  const order = orderRes[0]
  
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
    case 'dynamic_api': {
      // Generate an API key
      const keyString = 'sk_' + crypto.randomBytes(16).toString('hex')
      const quotaLimit = parseInt((productMeta as any).quota) || 0
      
      await db.insert(apiKeys).values({
        keyString,
        userId: order.userId || null,
        orderId: order.id,
        productId: product.id,
        quotaLimit: quotaLimit,
        quotaUsed: 0,
        isActive: true,
        createdAt: new Date()
      })
      
      // Push to external sync webhook if configured
      const syncUrl = (productMeta as any).sync_webhook_url
      if (syncUrl) {
        try {
          console.log(`[Fulfillment] Syncing dynamic_api key to ${syncUrl}`)
          const payload = JSON.stringify({
            orderId: order.id,
            key: keyString,
            quota: quotaLimit,
            timestamp: Date.now()
          })
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          }
          
          const syncSecret = (productMeta as any).sync_secret
          if (syncSecret) {
            headers['X-APayShop-Signature'] = crypto.createHmac('sha256', syncSecret).update(payload).digest('hex')
          }
          
          const syncRes = await fetch(syncUrl, {
            method: 'POST',
            headers,
            body: payload,
            signal: AbortSignal.timeout(5000)
          })
          
          if (!syncRes.ok) {
            console.error(`[Fulfillment] Sync API failed with status ${syncRes.status}`)
            // You might want to set newStatus to 'processing' here if sync is strictly required
            // newStatus = "processing"
          } else {
            console.log(`[Fulfillment] Sync API successful`)
          }
        } catch (syncErr: any) {
          console.error(`[Fulfillment] Sync API error:`, syncErr.message)
          // newStatus = "processing"
        }
      }

      deliveryInfo = keyString
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
  
  return { ...order, status: newStatus, deliveryInfo }
}