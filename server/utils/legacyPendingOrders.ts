import { and, eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders } from '../db/schema'
import { buildLocaleCurrencyQuote, normalizeCurrencyCode } from './localeCurrency'
import { normalizeOrderMetaData } from './checkoutBridge'

/**
 * 历史待支付订单币种锁定与快照
 */
export const lockLegacyPendingOrderCurrency = async (order: any, locale: string) => {
  const metaData = normalizeOrderMetaData(order.metaData)
  if (order.payStatus !== 'pending' || metaData.currencySnapshot) return order

  const quote = await buildLocaleCurrencyQuote(Number(order.amount || 0), locale)
  if (normalizeCurrencyCode(order.currency, 'USD') !== quote.baseCurrency) return order

  const currencySnapshot = {
    locale: quote.locale,
    baseCurrency: quote.baseCurrency,
    baseAmount: quote.baseAmount,
    currency: quote.currency,
    exchangeRate: quote.rate,
    amount: quote.amount,
    source: quote.source,
  }
  const checkoutBridge = metaData.checkoutBridge && typeof metaData.checkoutBridge === 'object'
    ? {
        ...metaData.checkoutBridge,
        amount: quote.amount,
        currency: quote.currency,
        sourceAmount: quote.baseAmount,
        sourceCurrency: quote.baseCurrency,
        exchangeRate: quote.rate,
      }
    : undefined
  const nextMetaData = {
    ...metaData,
    currencySnapshot,
    ...(checkoutBridge ? { checkoutBridge } : {}),
  }
  await db.update(orders)
    .set({
      amount: quote.amount,
      currency: quote.currency,
      metaData: process.env.NUXT_HUB_DATABASE ? nextMetaData : JSON.stringify(nextMetaData),
    })
    .where(and(
      eq(orders.id, order.id),
      eq(orders.payStatus, 'pending'),
      eq(orders.amount, order.amount),
      eq(orders.currency, order.currency),
    ))

  const latestOrders = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1)
  return latestOrders[0] || order
}
