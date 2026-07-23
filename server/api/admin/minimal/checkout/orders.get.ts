import { desc, eq } from 'drizzle-orm'
import { db } from '../../../../db/runtime'
import { orders, products } from '../../../../db/schema'
import { readMinimalCheckoutBridgeMeta } from '../../../../../app/themes/minimal/server/checkout/bridge'

type CheckoutAdminRow = {
  orderId: string
  externalOrderId: string
  amount: number
  currency: 'CNY'
  status: string | null
  payStatus: string | null
  payMethod: string | null
  tradeNo: string | null
  createdAt: Date | number | null
  paidAt: Date | number | null
  contactEmail: string | null
  productId: number | null
  productName: string | null
  notifyUrl: string | null
  returnUrl: string | null
  cancelUrl: string | null
  notifyStatus: string | null
  notifyAttemptedAt: string | null
  notifyDeliveredAt: string | null
  notifyHttpStatus: number | null
  attach: Record<string, any> | null
}

type SelectedOrderRow = {
  id: string
  amount: number
  status: string | null
  payStatus: string | null
  payMethod: string | null
  tradeNo: string | null
  visitorId: string | null
  createdAt: Date | number | null
  paidAt: Date | number | null
  contactEmail: string | null
  metaData: unknown
  productId: number | null
  productName: string | null
}

type CheckoutAdminSummary = {
  total: number
  paid: number
  pending: number
  notified: number
  notifyFailed: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(parseInt(String(query.page || '1'), 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(String(query.pageSize || '20'), 10) || 20, 1), 100)

  const rows = await db.select({
    id: orders.id,
    amount: orders.amount,
    status: orders.status,
    payStatus: orders.payStatus,
    payMethod: orders.payMethod,
    tradeNo: orders.tradeNo,
    visitorId: orders.visitorId,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    contactEmail: orders.contactEmail,
    metaData: orders.metaData,
    productId: products.id,
    productName: products.name,
  })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .orderBy(desc(orders.createdAt))
    .limit(2000) as SelectedOrderRow[]

  const bridgeOrders: CheckoutAdminRow[] = []
  for (const row of rows) {
    const bridge = readMinimalCheckoutBridgeMeta(row.metaData)
    if (!bridge) continue

    bridgeOrders.push({
      orderId: row.id,
      externalOrderId: bridge.externalOrderId,
      amount: row.amount,
      currency: 'CNY',
      status: row.status,
      payStatus: row.payStatus,
      payMethod: row.payMethod,
      tradeNo: row.tradeNo,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      contactEmail: bridge.customerEmail || row.contactEmail,
      productId: row.productId,
      productName: row.productName,
      notifyUrl: bridge.notifyUrl || null,
      returnUrl: bridge.returnUrl || null,
      cancelUrl: bridge.cancelUrl || null,
      notifyStatus: bridge.notify?.status || null,
      notifyAttemptedAt: bridge.notify?.attemptedAt || null,
      notifyDeliveredAt: bridge.notify?.deliveredAt || null,
      notifyHttpStatus: bridge.notify?.httpStatus ?? null,
      attach: bridge.attach || null,
    })
  }

  const total = bridgeOrders.length
  const offset = (page - 1) * pageSize
  const data = bridgeOrders.slice(offset, offset + pageSize)

  const summary = bridgeOrders.reduce<CheckoutAdminSummary>((acc, item) => {
    acc.total += 1
    if (item.payStatus === 'paid') acc.paid += 1
    if (item.payStatus === 'pending') acc.pending += 1
    if (item.notifyStatus === 'success') acc.notified += 1
    if (item.notifyStatus === 'failed') acc.notifyFailed += 1
    return acc
  }, {
    total: 0,
    paid: 0,
    pending: 0,
    notified: 0,
    notifyFailed: 0,
  })

  return {
    data,
    total,
    page,
    pageSize,
    summary,
  }
})
