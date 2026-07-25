import { orders, products, cards, subscriptions, users } from "../db/schema"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"
import { db } from '../db/runtime'
import { sendHttpWebhook } from './eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from './externalProxy'
import { createNotification } from './notifications'
import { creditBalance, topupEventId } from './balance'
import { getAffectedRows } from './dbResult'


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
      // 原子认领卡密:UPDATE 带 isUsed=false 条件,靠受影响行数确认本单抢到;
      // 先查后按 id 直改会让两个并发订单发出同一张卡。抢不到(被并发单拿走)
      // 就重选下一张,连续落空按缺货走人工。
      let claimedCard: typeof cards.$inferSelect | null = null
      for (let attempt = 0; attempt < 5 && !claimedCard; attempt++) {
        const cardRes = await db.select().from(cards).where(and(eq(cards.productId, product.id), eq(cards.isUsed, false))).limit(1)
        if (!cardRes.length) break
        const card = cardRes[0]!
        const claim = await db.update(cards)
          .set({ isUsed: true, orderId })
          .where(and(eq(cards.id, card.id), eq(cards.isUsed, false)))
        if (getAffectedRows(claim) > 0) {
          claimedCard = card
        }
      }
      if (claimedCard) {
        deliveryInfo = claimedCard.cardNumber
      } else {
        deliveryInfo = "Pending manual delivery (Out of stock)"
        newStatus = "processing" // Need manual intervention
      }
      await createNotification({
        userId: order.userId,
        visitorId: order.visitorId,
        type: 'key_delivered',
        title: '卡密已发放',
        message: `您购买的 ${product.name} 卡密已发放，请查看订单详情。`,
        data: { orderId, productId: product.id, slug: product.slug, targetPath: `/callback/${orderId}` },
      })
      break
    }
    case 'file': {
      deliveryInfo = product.resource || "Download link will be provided soon."
      await createNotification({
        userId: order.userId,
        visitorId: order.visitorId,
        type: 'file_delivered',
        title: '文件已就绪',
        message: `您购买的 ${product.name} 已可下载，请查看订单详情获取下载链接。`,
        data: { orderId, productId: product.id, slug: product.slug, targetPath: `/callback/${orderId}` },
      })
      break
    }
    case 'subscription': {
      newStatus = "active"
      deliveryInfo = `Subscription active. Duration: ${(productMeta as any).subscription_cycle || 'Unknown'}`

      // Cancel any existing active subscription for this user (upgrade scenario)
      // ainode will handle the old sub's remaining value transfer when it receives the new subscription.apply
      if (order.userId) {
        const oldSubs = await db.select({ id: subscriptions.id })
          .from(subscriptions)
          .where(and(
            eq(subscriptions.userId, order.userId),
            eq(subscriptions.status, 'active'),
          ))
        for (const old of oldSubs) {
          await db.update(subscriptions)
            .set({ status: 'canceled', cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(subscriptions.id, old.id))
        }
      }

      // Parse interval and intervalCount
      // subscription_cycle format: "1_month", "1_year"
      let interval = 'month'
      let intervalCount = 1
      if (productMeta && (productMeta as any).subscription_cycle) {
        const parts = String((productMeta as any).subscription_cycle).split('_')
        if (parts.length === 2) {
          intervalCount = parseInt(parts[0]!, 10) || 1
          interval = parts[1]!
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

      // Update user's TierLevel if product has a level defined
      const subProductLevel = (productMeta as any)?.level
      if (subProductLevel !== undefined && order.userId) {
        await db.update(users)
          .set({ TierLevel: Number(subProductLevel) })
          .where(eq(users.id, order.userId))
      }

      // Send subscription.apply event to ainode
      const grantAmount = Number((productMeta as any)?.grant_amount || 0)
      if (order.userId) {
        const [webhookUrl, ainodeToken] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
        if (webhookUrl && ainodeToken) {
          // 必须等待送达:Serverless 响应返回后运行时即回收,不等待会导致
          // 用户已付款但外部余额/权益未到账(sendHttpWebhook 自带重试,失败仅记日志)
          const eventId = `sub:apply:${subId}:1`
          await sendHttpWebhook(
            webhookUrl,
            {
              event: 'subscription.apply',
              timestamp: new Date().toISOString(),
              data: {
                eventId,
                userId: Number(order.userId),
                paidAmount: Number(order.amount) || 0,
                grantAmount,
                expiresAt: endDate.toISOString(),
                tier: Number(subProductLevel || 0),
                sourceId: order.id,
                remark: `${String(product.name || '')} ${String((productMeta as any)?.subscription_cycle || '').replace('_', ' ')}`.trim(),
              },
            },
            { headers: { Authorization: `Bearer ${ainodeToken}` } }
          )
        }
      }

      await createNotification({
        userId: order.userId,
        visitorId: order.visitorId,
        type: 'subscription_activated',
        title: '订阅已激活',
        message: `您已成功订阅 ${product.name}，有效期至 ${endDate.toISOString().split('T')[0]}。`,
        data: { orderId, productId: product.id, subscriptionId: subId, targetPath: `/callback/${orderId}` },
      })

      break
    }
    case 'service': {
      newStatus = "processing"
      deliveryInfo = "Service order received. Our team will contact you shortly."
      await createNotification({
        userId: order.userId,
        visitorId: order.visitorId,
        type: 'service_processing',
        title: '服务订单已接收',
        message: `您购买的 ${product.name} 服务已接收，我们将尽快与您联系。`,
        data: { orderId, productId: product.id, targetPath: `/user/orders/${orderId}` },
      })
      break
    }
    case 'topup': {
      // 订单级优先:快捷充值是可变金额,到账额度由服务端按币种折算后写在订单上
      // (与 buildOrderIntegration 的取值顺序保持一致,否则通知里显示的是原币金额)
      const rechargeAmount = firstPositiveNumber(
        (orderMeta as any).recharge_amount,
        (productMeta as any).recharge_amount,
        order.amount,
      )
      const unit = String(
        (orderMeta as any).display_unit || (productMeta as any).display_unit || 'credits',
      ).trim()
      // 本地入账:余额的权威账本在 apay 自己的 users.CashBalance + balance_logs。
      // 幂等键取订单号,支付回调重试/用户重复触发都只会到账一次(见 utils/balance.ts)。
      // 到账额度用订单上服务端算好的 recharge_amount(记账币种),不是实付原币金额。
      if (order.userId && rechargeAmount > 0) {
        try {
          const credited = await creditBalance({
            userId: Number(order.userId),
            balanceType: String((orderMeta as any).balance_type || (productMeta as any).balance_type || 'cash') === 'grant'
              ? 'grant'
              : 'cash',
            amount: rechargeAmount,
            eventId: topupEventId(orderId),
            actionType: 'topup',
            sourceType: 'order',
            sourceId: orderId,
            remark: `充值订单 ${orderId}`,
          })
          if (!credited.applied) {
            console.log(`[Balance] topup ${orderId} already credited, skipped`)
          }
        } catch (error) {
          // 入账失败不能吞掉:钱已经收了,必须让调用方看到(履约整体会记录失败)
          console.error(`[Balance] failed to credit topup order ${orderId}:`, error)
          throw error
        }
      }

      deliveryInfo = (productMeta as any).delivery_message
        || `Top-up payment confirmed. ${rechargeAmount} ${unit} will be credited to your account.`
      await createNotification({
        userId: order.userId,
        visitorId: order.visitorId,
        type: 'topup_credited',
        title: '充值已到账',
        message: `您已成功充值 ${rechargeAmount} ${unit}，余额已更新。`,
        data: { orderId, productId: product.id, targetPath: `/callback/${orderId}` },
      })
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
