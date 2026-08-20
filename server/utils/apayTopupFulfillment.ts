import { and, eq } from 'drizzle-orm'
import { fulfillMinimalCheckoutRelay } from '../../app/themes/minimal/server/checkout/fulfillment'
import { deliverMinimalCheckoutPaid } from '../../app/themes/minimal/server/checkout/notify'
import { readMinimalCheckoutBridgeMeta } from '../../app/themes/minimal/server/checkout/bridge'
import { settlePromoCommission } from '../promo/service'
import { db } from '../db/runtime'
import { orders, topups } from '../db/schema'

export async function recoverCreditedApayTopup(orderId: string) {
  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const order = orderRows[0]
  if (!order) return false

  const bridge = readMinimalCheckoutBridgeMeta(order.metaData)
  if (bridge?.attach?.walletOwner !== 'apay') return false

  const rows = await db.select({ topupStatus: topups.status })
    .from(orders)
    .innerJoin(topups, and(eq(topups.orderId, orders.id), eq(topups.status, 'credited')))
    .where(eq(orders.id, orderId))
    .limit(1)
  const row = rows[0]
  if (!row) return false

  const fulfilled = await fulfillMinimalCheckoutRelay(orderId)
  if (!fulfilled) return false
  await settlePromoCommission(orderId)
  await deliverMinimalCheckoutPaid(fulfilled)
  return true
}
