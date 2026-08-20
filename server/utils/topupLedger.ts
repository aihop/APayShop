import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '../db/runtime'
import { balanceLogs, orders, products, topups } from '../db/schema'
import { BALANCE_SCALE, clawbackTopup, creditBalance, refundEventId, topupEventId, type BalanceType } from './balance'
import { getAffectedRows } from './dbResult'
import { getOrCreateUserWallet } from './userWallet'
import { ORDER_PAY_STATUS } from './constants'
import { recoverCreditedApayTopup } from './apayTopupFulfillment'

export const TOPUP_STATUS = {
  PENDING: 'pending',
  PAYMENT_FAILED: 'payment_failed',
  PAID: 'paid',
  CREDITING: 'crediting',
  CREDITED: 'credited',
  CREDIT_FAILED: 'credit_failed',
  REVIEW_REQUIRED: 'review_required',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded',
} as const

export type TopupStatus = typeof TOPUP_STATUS[keyof typeof TOPUP_STATUS]

const normalizeMeta = (value: unknown): Record<string, any> => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

const firstPositiveNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 0
}

const isDuplicateKeyError = (error: unknown) =>
  /duplicate|unique/i.test(String((error as { message?: unknown })?.message || ''))

export interface CreateTopupRecordInput {
  orderId: string
  userId: number
  paymentAmount: number
  paymentCurrency: string
  creditAmount: number
  creditCurrency: string
  exchangeRate?: number
  balanceType?: BalanceType
  source?: string
  createdAt?: Date
}

export async function createTopupRecord(input: CreateTopupRecordInput) {
  const wallet = await getOrCreateUserWallet(input.userId)
  const values = {
    orderId: input.orderId,
    userId: input.userId,
    walletId: wallet.id,
    source: String(input.source || 'order').slice(0, 32),
    paymentAmount: Number(input.paymentAmount),
    paymentCurrency: String(input.paymentCurrency || 'USD').trim().toUpperCase(),
    creditAmountCents: Math.round(Number(input.creditAmount) * BALANCE_SCALE),
    creditCurrency: String(input.creditCurrency || 'USD').trim().toUpperCase(),
    exchangeRate: Number.isFinite(Number(input.exchangeRate)) ? Number(input.exchangeRate) : 1,
    balanceType: input.balanceType === 'grant' ? 'grant' : 'cash',
    status: TOPUP_STATUS.PENDING,
    creditEventId: topupEventId(input.orderId),
    createdAt: input.createdAt || new Date(),
    updatedAt: new Date(),
  }
  try {
    await db.insert(topups).values(values as any)
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }
  const rows = await db.select().from(topups).where(eq(topups.orderId, input.orderId)).limit(1)
  if (!rows[0]) throw new Error(`Failed to create top-up record for order ${input.orderId}`)
  return rows[0]
}

export async function ensureTopupRecordForOrder(orderId: string) {
  const rows = await db.select({ order: orders, productType: products.type, productSlug: products.slug })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.id, orderId))
    .limit(1)
  const row = rows[0]
  if (!row || row.productType !== 'topup' || !row.order.userId) return null

  const meta = normalizeMeta(row.order.metaData)
  const bridge = normalizeMeta(meta.checkoutBridge)
  const attach = normalizeMeta(bridge.attach)
  if (row.productSlug === 'minimal-checkout-recharge' && attach.walletOwner !== 'apay') return null

  const existing = await db.select().from(topups).where(eq(topups.orderId, orderId)).limit(1)
  if (existing[0]) return existing[0]

  const currencySnapshot = normalizeMeta(meta.currencySnapshot)
  const creditAmount = firstPositiveNumber(
    bridge.rechargeAmount,
    meta.recharge_amount,
    bridge.sourceAmount,
    currencySnapshot.baseAmount,
    row.order.amount,
  )
  if (!(creditAmount > 0)) throw new Error(`Top-up order ${orderId} has no positive credit amount`)

  return createTopupRecord({
    orderId,
    userId: Number(row.order.userId),
    paymentAmount: Number(row.order.amount),
    paymentCurrency: String(row.order.currency || 'USD'),
    creditAmount,
    creditCurrency: String(bridge.rechargeCurrency || meta.display_unit || currencySnapshot.baseCurrency || row.order.currency || 'USD'),
    exchangeRate: Number(bridge.exchangeRate ?? currencySnapshot.exchangeRate ?? 1),
    balanceType: String(bridge.balanceType || meta.balance_type || 'cash') === 'grant' ? 'grant' : 'cash',
    source: String(row.order.source || 'order'),
    createdAt: row.order.createdAt || new Date(),
  })
}

export type SettlePaidTopupOutcome = 'not_topup' | 'processing' | 'credited' | 'already_credited' | 'review_required'

export async function settlePaidTopup(orderId: string): Promise<SettlePaidTopupOutcome> {
  const topup = await ensureTopupRecordForOrder(orderId)
  if (!topup) return 'not_topup'
  const orderRows = await db.select({ payStatus: orders.payStatus, paidAt: orders.paidAt })
    .from(orders).where(eq(orders.id, orderId)).limit(1)
  if (orderRows[0]?.payStatus !== ORDER_PAY_STATUS.PAID) return 'processing'
  if (topup.status === TOPUP_STATUS.CREDITED) return 'already_credited'
  if (topup.status === TOPUP_STATUS.REFUNDED || topup.status === TOPUP_STATUS.REFUNDING || topup.status === TOPUP_STATUS.REVIEW_REQUIRED) {
    return 'review_required'
  }

  const now = new Date()
  await db.update(topups).set({
    status: TOPUP_STATUS.PAID,
    paidAt: topup.paidAt || orderRows[0].paidAt || now,
    lastError: null,
    updatedAt: now,
  }).where(and(
    eq(topups.id, topup.id),
    inArray(topups.status, [TOPUP_STATUS.PENDING, TOPUP_STATUS.PAYMENT_FAILED]),
  ))

  const claim = await db.update(topups).set({
    status: TOPUP_STATUS.CREDITING,
    paidAt: topup.paidAt || orderRows[0].paidAt || now,
    retryCount: sql`${topups.retryCount} + 1` as any,
    lastError: null,
    updatedAt: now,
  }).where(and(
    eq(topups.id, topup.id),
    inArray(topups.status, [TOPUP_STATUS.PAID, TOPUP_STATUS.CREDIT_FAILED]),
  ))

  if (getAffectedRows(claim) === 0) {
    const current = await db.select({ status: topups.status }).from(topups).where(eq(topups.id, topup.id)).limit(1)
    if (current[0]?.status === TOPUP_STATUS.CREDITED) return 'already_credited'
    if (current[0]?.status === TOPUP_STATUS.REVIEW_REQUIRED) return 'review_required'
    return 'processing'
  }

  try {
    const credited = await creditBalance({
      userId: Number(topup.userId),
      balanceType: topup.balanceType === 'grant' ? 'grant' : 'cash',
      amount: Number(topup.creditAmountCents) / BALANCE_SCALE,
      eventId: topup.creditEventId,
      actionType: 'topup',
      sourceType: 'order',
      sourceId: orderId,
      remark: `充值订单 ${orderId}`,
    })
    if (!credited.applied) {
      const current = await db.select({ status: topups.status }).from(topups).where(eq(topups.id, topup.id)).limit(1)
      if (current[0]?.status === TOPUP_STATUS.CREDITED) return 'already_credited'
      await db.update(topups).set({
        status: TOPUP_STATUS.REVIEW_REQUIRED,
        lastError: '到账事件已存在但充值状态未完成，需人工核对钱包余额，禁止自动重复入账',
        updatedAt: new Date(),
      }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
      return 'review_required'
    }
    const completed = await db.update(topups).set({
      status: TOPUP_STATUS.CREDITED,
      creditedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
    if (getAffectedRows(completed) === 0) {
      await db.update(topups).set({
        status: TOPUP_STATUS.REVIEW_REQUIRED,
        lastError: '到账期间状态被并发修改，资金可能已入账，需人工核对后处理',
        updatedAt: new Date(),
      }).where(and(eq(topups.id, topup.id), ne(topups.status, TOPUP_STATUS.CREDITED)))
      return 'review_required'
    }
    return 'credited'
  } catch (error) {
    await db.update(topups).set({
      status: TOPUP_STATUS.CREDIT_FAILED,
      lastError: String((error as { message?: unknown })?.message || error).slice(0, 2000),
      updatedAt: new Date(),
    }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
    throw error
  }
}

export async function markTopupPaymentFailed(orderId: string, error?: string) {
  const topup = await ensureTopupRecordForOrder(orderId)
  if (!topup) return false
  await db.update(topups).set({
    status: TOPUP_STATUS.PAYMENT_FAILED,
    lastError: String(error || '支付失败').slice(0, 2000),
    updatedAt: new Date(),
  }).where(and(
    eq(topups.id, topup.id),
    inArray(topups.status, [TOPUP_STATUS.PENDING, TOPUP_STATUS.PAYMENT_FAILED]),
  ))
  return true
}

export async function refundTopup(orderId: string, operator?: { adminId?: number | null; name?: string }) {
  const topup = await ensureTopupRecordForOrder(orderId)
  if (!topup) return { applicable: false, applied: false, shortfall: 0 }
  if (topup.status === TOPUP_STATUS.REFUNDED) {
    return { applicable: true, applied: false, shortfall: Number(topup.shortfallCents || 0) / BALANCE_SCALE }
  }
  if (topup.status === TOPUP_STATUS.CREDITING) {
    await db.update(topups).set({
      status: TOPUP_STATUS.REVIEW_REQUIRED,
      lastError: '退款与到账并发，资金结果不确定，需人工核对后处理',
      updatedAt: new Date(),
    }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
    return { applicable: true, applied: false, processing: true, shortfall: 0 }
  }

  const creditedLog = await db.select({ id: balanceLogs.id }).from(balanceLogs)
    .where(eq(balanceLogs.eventId, topup.creditEventId)).limit(1)
  if (!creditedLog[0]) {
    if (topup.status === TOPUP_STATUS.CREDITED || topup.status === TOPUP_STATUS.REVIEW_REQUIRED) {
      await db.update(topups).set({
        status: TOPUP_STATUS.REVIEW_REQUIRED,
        lastError: '充值状态与到账流水不一致，退款不能自动处理，需人工核对',
        updatedAt: new Date(),
      }).where(eq(topups.id, topup.id))
      return { applicable: true, applied: false, processing: true, shortfall: 0 }
    }
    const noCreditRefund = await db.update(topups).set({
      status: TOPUP_STATUS.REFUNDED,
      refundEventId: refundEventId(orderId),
      refundedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(and(
      eq(topups.id, topup.id),
      inArray(topups.status, [
        TOPUP_STATUS.PENDING,
        TOPUP_STATUS.PAYMENT_FAILED,
        TOPUP_STATUS.PAID,
        TOPUP_STATUS.CREDIT_FAILED,
      ]),
    ))
    if (getAffectedRows(noCreditRefund) === 0) {
      const current = await db.select({ status: topups.status }).from(topups)
        .where(eq(topups.id, topup.id)).limit(1)
      if (current[0]?.status === TOPUP_STATUS.CREDITED) return refundTopup(orderId, operator)
      if (current[0]?.status === TOPUP_STATUS.CREDITING) {
        await db.update(topups).set({
          status: TOPUP_STATUS.REVIEW_REQUIRED,
          lastError: '退款与到账并发，资金结果不确定，需人工核对后处理',
          updatedAt: new Date(),
        }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
      }
      return { applicable: true, applied: false, processing: true, shortfall: 0 }
    }
    return { applicable: true, applied: false, shortfall: 0 }
  }
  if (topup.status !== TOPUP_STATUS.CREDITED) {
    await db.update(topups).set({
      status: TOPUP_STATUS.REVIEW_REQUIRED,
      lastError: '存在到账流水但未确认钱包已加款，退款不能自动扣回，需人工核对',
      updatedAt: new Date(),
    }).where(eq(topups.id, topup.id))
    return { applicable: true, applied: false, processing: true, shortfall: 0 }
  }

  const refundClaim = await db.update(topups).set({
    status: TOPUP_STATUS.REFUNDING,
    updatedAt: new Date(),
  }).where(and(
    eq(topups.id, topup.id),
    eq(topups.status, TOPUP_STATUS.CREDITED),
  ))
  if (getAffectedRows(refundClaim) === 0) {
    const current = await db.select({ status: topups.status, shortfallCents: topups.shortfallCents })
      .from(topups).where(eq(topups.id, topup.id)).limit(1)
    return {
      applicable: true,
      applied: false,
      processing: current[0]?.status === TOPUP_STATUS.REFUNDING,
      shortfall: Number(current[0]?.shortfallCents || 0) / BALANCE_SCALE,
    }
  }
  try {
    const result = await clawbackTopup({
      userId: Number(topup.userId),
      orderId,
      operatorAdminId: operator?.adminId ?? null,
      operatorName: operator?.name || '',
      remark: `订单退款回收 ${orderId}`,
    })
    const completed = await db.update(topups).set({
      status: TOPUP_STATUS.REFUNDED,
      refundEventId: refundEventId(orderId),
      shortfallCents: Math.round(result.shortfall * BALANCE_SCALE),
      refundedAt: new Date(),
      lastError: result.shortfall > 0 ? `余额不足，未回收 ${result.shortfall}` : null,
      updatedAt: new Date(),
    }).where(and(eq(topups.id, topup.id), eq(topups.status, TOPUP_STATUS.REFUNDING)))
    if (getAffectedRows(completed) === 0) {
      return { applicable: true, applied: result.applied, processing: true, shortfall: result.shortfall }
    }
    return { applicable: true, ...result }
  } catch (error) {
    await db.update(topups).set({
      status: TOPUP_STATUS.REVIEW_REQUIRED,
      lastError: `退款回收失败：${String((error as { message?: unknown })?.message || error)}`.slice(0, 2000),
      updatedAt: new Date(),
    }).where(eq(topups.id, topup.id))
    throw error
  }
}

export async function retryIncompleteTopups(limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const staleBefore = new Date(Date.now() - 5 * 60_000)
  const staleRows = await db.select({ id: topups.id }).from(topups)
    .where(and(eq(topups.status, TOPUP_STATUS.CREDITING), lt(topups.updatedAt, staleBefore)))
    .limit(safeLimit)
  for (const row of staleRows) {
    await db.update(topups).set({
      status: TOPUP_STATUS.CREDIT_FAILED,
      lastError: '到账处理中断，进入安全重试',
      updatedAt: new Date(),
    }).where(and(eq(topups.id, row.id), eq(topups.status, TOPUP_STATUS.CREDITING)))
  }

  await db.update(topups).set({
    status: TOPUP_STATUS.REVIEW_REQUIRED,
    lastError: '退款处理中断，可能已写入扣款流水，需人工核对后处理',
    updatedAt: new Date(),
  }).where(and(eq(topups.status, TOPUP_STATUS.REFUNDING), lt(topups.updatedAt, staleBefore)))

  const candidates = await db.select({ orderId: topups.orderId }).from(topups)
    .innerJoin(orders, eq(orders.id, topups.orderId))
    .where(and(
      inArray(topups.status, [TOPUP_STATUS.PENDING, TOPUP_STATUS.PAYMENT_FAILED, TOPUP_STATUS.PAID, TOPUP_STATUS.CREDIT_FAILED]),
      eq(orders.payStatus, ORDER_PAY_STATUS.PAID),
    ))
    .orderBy(topups.updatedAt)
    .limit(safeLimit)
  const report = { scanned: candidates.length, credited: 0, alreadyCredited: 0, processing: 0, reviewRequired: 0, failed: 0 }
  for (const row of candidates) {
    try {
      const outcome = await settlePaidTopup(row.orderId)
      if (outcome === 'credited') {
        report.credited++
        await recoverCreditedApayTopup(row.orderId)
      } else if (outcome === 'already_credited') {
        report.alreadyCredited++
        await recoverCreditedApayTopup(row.orderId)
      }
      else if (outcome === 'review_required') report.reviewRequired++
      else report.processing++
    } catch {
      report.failed++
    }
  }
  return report
}

export async function listUserTopups(userId: number, page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const where = eq(topups.userId, userId)
  const [rows, totalRows] = await Promise.all([
    db.select().from(topups).where(where).orderBy(desc(topups.createdAt)).limit(safePageSize).offset((safePage - 1) * safePageSize),
    db.select({ count: sql<number>`count(*)` }).from(topups).where(where),
  ])
  return {
    page: safePage,
    pageSize: safePageSize,
    total: Number(totalRows[0]?.count || 0),
    list: rows.map((row: any) => ({
      id: Number(row.id),
      orderId: row.orderId,
      paymentAmount: Number(row.paymentAmount),
      paymentCurrency: row.paymentCurrency,
      creditAmount: Number(row.creditAmountCents) / BALANCE_SCALE,
      creditCurrency: row.creditCurrency,
      exchangeRate: Number(row.exchangeRate || 1),
      balanceType: row.balanceType,
      status: row.status,
      retryCount: Number(row.retryCount || 0),
      shortfall: Number(row.shortfallCents || 0) / BALANCE_SCALE,
      lastError: row.lastError,
      paidAt: row.paidAt,
      creditedAt: row.creditedAt,
      refundedAt: row.refundedAt,
      createdAt: row.createdAt,
    })),
  }
}
