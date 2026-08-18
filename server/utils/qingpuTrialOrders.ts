import crypto from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders, products } from '../db/schema'
import { ORDER_PAY_STATUS, ORDER_STATUS } from './constants'
import { getAffectedRows } from './dbResult'
import { sendHttpWebhook } from './eventBus'
import { getIntegrationToken, getWebhookSubscriptionUrl } from './externalProxy'

export const QINGPU_TRIAL_ORDER_SOURCE = 'qingpu_trial'

export interface QingpuTrialPolicySnapshot {
  productId: number
  priceUsd: number
  exchangeRate: 7
  paymentAmountCny: number
  reviewRequired: boolean
  durationDays: number
  grantAmount: number
  features: { listing: boolean, studio: boolean, ops: boolean }
  limits: { stores: number, employees: number }
}

export type QingpuTrialOrderState = 'pending_payment' | 'pending_review' | 'processing' | 'failed' | 'approved' | 'rejected'

interface QingpuTrialMeta {
  version: 2
  state: QingpuTrialOrderState
  policy: QingpuTrialPolicySnapshot
  requestedAt: string
  reviewedAt?: string
  reviewedByAdminId?: number
  expiresAt?: string
  walletEligibilityCheckedAt?: string
  lastError?: string
}

type TrialOrderShape = Pick<typeof orders.$inferSelect, 'id' | 'userId' | 'contactEmail' | 'productId' | 'metaData'>

export interface QingpuTrialOrder {
  id: string
  userId: number
  email: string
  productId: number
  state: QingpuTrialOrderState
  policy: QingpuTrialPolicySnapshot
  requestedAt: string
  reviewedAt: string | null
  reviewedByAdminId: number | null
  expiresAt: string | null
  walletEligibilityCheckedAt: string | null
  lastError: string | null
}

const normalizeMeta = (value: unknown): Record<string, unknown> => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeLegacyPolicy = (value: Record<string, unknown>): QingpuTrialPolicySnapshot => ({
  productId: Number(value.productId),
  priceUsd: Number(value.priceUsd || 0),
  exchangeRate: 7,
  paymentAmountCny: Number(value.paymentAmountCny || 0),
  reviewRequired: Boolean(value.reviewRequired),
  durationDays: Number(value.durationDays),
  grantAmount: Number(value.grantAmount),
  features: value.features as QingpuTrialPolicySnapshot['features'],
  limits: value.limits as QingpuTrialPolicySnapshot['limits'],
})

const readTrialMeta = (value: unknown): QingpuTrialMeta => {
  const meta = normalizeMeta(value).qingpuTrial
  if (!meta || typeof meta !== 'object' || !('version' in meta)) {
    throw new Error('Invalid Qingpu trial order snapshot')
  }
  const input = meta as Record<string, unknown>
  if (input.version !== 1 && input.version !== 2) {
    throw new Error('Unsupported Qingpu trial order snapshot')
  }
  return {
    ...input,
    version: 2,
    policy: normalizeLegacyPolicy(input.policy as Record<string, unknown>),
  } as QingpuTrialMeta
}

const mergeTrialMeta = (value: unknown, trial: QingpuTrialMeta) => ({
  ...normalizeMeta(value),
  qingpuTrial: trial,
})

const toTrialOrder = (row: TrialOrderShape): QingpuTrialOrder => {
  const meta = readTrialMeta(row.metaData)
  return {
    id: String(row.id),
    userId: Number(row.userId),
    email: String(row.contactEmail),
    productId: Number(row.productId),
    state: meta.state,
    policy: meta.policy,
    requestedAt: meta.requestedAt,
    reviewedAt: meta.reviewedAt || null,
    reviewedByAdminId: meta.reviewedByAdminId || null,
    expiresAt: meta.expiresAt || null,
    walletEligibilityCheckedAt: meta.walletEligibilityCheckedAt || null,
    lastError: meta.lastError || null,
  }
}

const findTrialOrderByUserId = async (userId: number) => {
  const rows = await db.select().from(orders).where(and(
    eq(orders.source, QINGPU_TRIAL_ORDER_SOURCE),
    eq(orders.externalOrderId, `user:${userId}`),
  )).limit(1)
  return rows[0] || null
}

export async function listQingpuTrialProducts() {
  const rows: Array<{ id: number, name: string, type: string, price: number, isActive: boolean }> = await db.select({
    id: products.id,
    name: products.name,
    type: products.type,
    price: products.price,
    isActive: products.isActive,
  }).from(products).where(eq(products.isActive, true))
  return rows
    .filter(product => Number(product.price) === 0)
    .map(product => ({ id: Number(product.id), name: product.name, type: product.type }))
}

export async function assertQingpuTrialProduct(productId: number) {
  const rows = await db.select({
    id: products.id,
    name: products.name,
    price: products.price,
    isActive: products.isActive,
  }).from(products).where(eq(products.id, productId)).limit(1)
  const product = rows[0]
  if (!product || !product.isActive || Number(product.price) !== 0) {
    throw createError({ statusCode: 400, message: '试用商品必须存在、已启用且价格为 0' })
  }
  return { id: Number(product.id), name: product.name }
}

export async function createQingpuTrialOrder(input: {
  userId: number
  email: string
  policy: QingpuTrialPolicySnapshot
  reviewRequired: boolean
}): Promise<{ order: QingpuTrialOrder, created: boolean }> {
  await assertQingpuTrialProduct(input.policy.productId)
  const existing = await findTrialOrderByUserId(input.userId)
  if (existing) return { order: toTrialOrder(existing), created: false }

  const requestedAt = new Date().toISOString()
  const orderId = `TR${requestedAt.slice(0, 10).replaceAll('-', '')}${crypto.randomBytes(7).toString('hex').toUpperCase()}`
  const paidTrial = input.policy.paymentAmountCny > 0
  const state: QingpuTrialOrderState = paidTrial
    ? 'pending_payment'
    : input.reviewRequired ? 'pending_review' : 'processing'
  const trial: QingpuTrialMeta = {
    version: 2,
    state,
    policy: structuredClone(input.policy),
    requestedAt,
    ...(!paidTrial && !input.reviewRequired ? {
      reviewedAt: requestedAt,
      expiresAt: new Date(Date.now() + input.policy.durationDays * 86_400_000).toISOString(),
    } : {}),
  }
  const metaData = {
    currencySnapshot: {
      locale: 'zh-cn',
      baseCurrency: 'USD',
      baseAmount: input.policy.priceUsd,
      currency: 'CNY',
      exchangeRate: input.policy.exchangeRate,
      amount: input.policy.paymentAmountCny,
      source: 'qingpu-trial-policy',
    },
    qingpuTrial: trial,
  }
  try {
    await db.insert(orders).values({
      id: orderId,
      amount: input.policy.paymentAmountCny,
      currency: 'CNY',
      source: QINGPU_TRIAL_ORDER_SOURCE,
      externalOrderId: `user:${input.userId}`,
      productId: input.policy.productId,
      userId: input.userId,
      contactEmail: input.email,
      payMethod: paidTrial ? 'none' : 'trial',
      status: paidTrial || input.reviewRequired ? ORDER_STATUS.NONE : ORDER_STATUS.PROCESSING,
      payStatus: paidTrial || input.reviewRequired ? ORDER_PAY_STATUS.PENDING : ORDER_PAY_STATUS.PAID,
      paidAt: paidTrial || input.reviewRequired ? null : new Date(),
      deliveryInfo: paidTrial ? 'Trial payment pending' : input.reviewRequired ? 'Trial review pending' : 'Trial fulfillment processing',
      metaData,
      createdAt: new Date(),
    })
    return {
      order: toTrialOrder({
        id: orderId,
        userId: input.userId,
        contactEmail: input.email,
        productId: input.policy.productId,
        metaData,
      }),
      created: true,
    }
  } catch (error) {
    const concurrent = await findTrialOrderByUserId(input.userId)
    if (concurrent) return { order: toTrialOrder(concurrent), created: false }
    throw error
  }
}

export async function listQingpuTrialOrders(limit = 100): Promise<QingpuTrialOrder[]> {
  const rows = await db.select().from(orders)
    .where(eq(orders.source, QINGPU_TRIAL_ORDER_SOURCE))
    .orderBy(desc(orders.createdAt))
    .limit(Math.min(500, Math.max(1, limit)))
  return rows.map(toTrialOrder)
}

export async function markQingpuTrialPaymentReceived(orderId: string): Promise<'pending_review' | 'ready'> {
  const rows = await db.select().from(orders).where(and(
    eq(orders.id, orderId),
    eq(orders.source, QINGPU_TRIAL_ORDER_SOURCE),
  )).limit(1)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, message: '试用订单不存在' })
  const current = readTrialMeta(row.metaData)
  if (current.state !== 'pending_payment') {
    return current.state === 'pending_review' ? 'pending_review' : 'ready'
  }
  const next: QingpuTrialMeta = {
    ...current,
    state: current.policy.reviewRequired ? 'pending_review' : 'pending_payment',
  }
  const moved = await db.update(orders).set({
    status: ORDER_STATUS.NONE,
    deliveryInfo: current.policy.reviewRequired
      ? 'Trial payment received; review pending'
      : 'Trial payment received; fulfillment ready',
    metaData: mergeTrialMeta(row.metaData, next),
  }).where(and(
    eq(orders.id, orderId),
    eq(orders.deliveryInfo, 'Trial payment pending'),
  ))
  if (getAffectedRows(moved) > 0) {
    return current.policy.reviewRequired ? 'pending_review' : 'ready'
  }
  const latest = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const latestMeta = readTrialMeta(latest[0]?.metaData)
  return latestMeta.state === 'pending_review' ? 'pending_review' : 'ready'
}

export async function beginQingpuTrialFulfillment(orderId: string, adminId: number | null) {
  const rows = await db.select().from(orders).where(and(
    eq(orders.id, orderId),
    eq(orders.source, QINGPU_TRIAL_ORDER_SOURCE),
  )).limit(1)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, message: '试用申请不存在' })
  const current = readTrialMeta(row.metaData)
  if (current.state === 'approved') return { order: toTrialOrder(row), claimed: false }
  if (current.state === 'rejected') throw createError({ statusCode: 409, message: '试用申请已拒绝' })
  if (current.state === 'pending_payment' && row.payStatus !== ORDER_PAY_STATUS.PAID) {
    throw createError({ statusCode: 409, message: '试用订单尚未支付' })
  }
  if (current.state === 'pending_payment' && row.deliveryInfo === 'Trial payment pending') {
    throw createError({ statusCode: 409, message: '试用订单支付状态正在确认' })
  }
  if (current.state === 'pending_review' && !adminId) {
    throw createError({ statusCode: 409, message: '试用申请等待管理员审核' })
  }
  if (current.state === 'processing') {
    const processingSince = Date.parse(current.reviewedAt || current.requestedAt)
    if (Number.isFinite(processingSince) && Date.now() - processingSince < 5 * 60 * 1000) {
      return { order: toTrialOrder(row), claimed: false }
    }
    const recovered = await db.update(orders).set({ status: ORDER_STATUS.FAILED }).where(and(
      eq(orders.id, orderId),
      eq(orders.status, ORDER_STATUS.PROCESSING),
    ))
    if (getAffectedRows(recovered) === 0) {
      const latest = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      return { order: toTrialOrder(latest[0]), claimed: false }
    }
  }

  await assertQingpuTrialProduct(current.policy.productId)
  const reviewedAt = new Date().toISOString()
  const next: QingpuTrialMeta = {
    ...current,
    state: 'processing',
    reviewedAt: current.reviewedAt || reviewedAt,
    ...(adminId ? { reviewedByAdminId: adminId } : {}),
    expiresAt: current.expiresAt || new Date(Date.now() + current.policy.durationDays * 86_400_000).toISOString(),
    lastError: undefined,
  }
  const claim = await db.update(orders).set({
    status: ORDER_STATUS.PROCESSING,
    deliveryInfo: 'Trial fulfillment processing',
    metaData: mergeTrialMeta(row.metaData, next),
  }).where(and(
    eq(orders.id, orderId),
    inArray(orders.status, [ORDER_STATUS.NONE, ORDER_STATUS.FAILED]),
  ))
  if (getAffectedRows(claim) === 0) {
    const latest = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    return { order: toTrialOrder(latest[0]), claimed: false }
  }
  return { order: toTrialOrder({ ...row, status: ORDER_STATUS.PROCESSING, metaData: mergeTrialMeta(row.metaData, next) }), claimed: true }
}

export async function deliverQingpuTrialGrant(order: QingpuTrialOrder) {
  if (!order.expiresAt) throw new Error('Trial expiration snapshot is missing')
  if (order.policy.grantAmount <= 0) return
  const [webhookUrl, token] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
  if (!webhookUrl || !token) throw new Error('AINode integration webhook is not configured')
  const result = await sendHttpWebhook(webhookUrl, {
    event: 'subscription.apply',
    timestamp: new Date().toISOString(),
    data: {
      userId: order.userId,
      email: order.email,
      eventId: `trial:apply:${order.id}`,
      paidAmount: 0,
      grantAmount: order.policy.grantAmount,
      expiresAt: order.expiresAt,
      tier: 0,
      sourceId: order.id,
      remark: 'Qingpu trial grant',
    },
  }, { headers: { Authorization: `Bearer ${token}` }, retries: 3, timeout: 8000 })
  if (!result.ok) throw new Error(`AINode trial grant delivery failed${result.status ? ` (${result.status})` : ''}`)
}

export async function markQingpuTrialWalletEligible(orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, message: '试用申请不存在' })
  const current = readTrialMeta(row.metaData)
  if (current.walletEligibilityCheckedAt) return current.walletEligibilityCheckedAt
  const checkedAt = new Date().toISOString()
  await db.update(orders).set({
    metaData: mergeTrialMeta(row.metaData, { ...current, walletEligibilityCheckedAt: checkedAt }),
  }).where(eq(orders.id, orderId))
  return checkedAt
}

export async function completeQingpuTrialOrder(orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, message: '试用申请不存在' })
  const current = readTrialMeta(row.metaData)
  const next: QingpuTrialMeta = { ...current, state: 'approved', lastError: undefined }
  await db.update(orders).set({
    payStatus: ORDER_PAY_STATUS.PAID,
    paidAt: row.paidAt || new Date(),
    status: ORDER_STATUS.DELIVERED,
    deliveryInfo: `Trial active until ${current.expiresAt}`,
    metaData: mergeTrialMeta(row.metaData, next),
  }).where(eq(orders.id, orderId))
}

export async function failQingpuTrialOrder(orderId: string, error: unknown) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const row = rows[0]
  if (!row) return
  const current = readTrialMeta(row.metaData)
  const message = error instanceof Error ? error.message : String(error)
  await db.update(orders).set({
    status: ORDER_STATUS.FAILED,
    deliveryInfo: `Trial fulfillment failed: ${message}`,
    metaData: mergeTrialMeta(row.metaData, { ...current, state: 'failed', lastError: message.slice(0, 1000) }),
  }).where(eq(orders.id, orderId))
}

export async function rejectQingpuTrialOrder(orderId: string, adminId: number) {
  const rows = await db.select().from(orders).where(and(
    eq(orders.id, orderId),
    eq(orders.source, QINGPU_TRIAL_ORDER_SOURCE),
  )).limit(1)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, message: '试用申请不存在' })
  const current = readTrialMeta(row.metaData)
  if (current.state !== 'pending_review') throw createError({ statusCode: 409, message: '只有待审核申请可以拒绝' })
  const next: QingpuTrialMeta = {
    ...current,
    state: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedByAdminId: adminId,
  }
  const rejected = await db.update(orders).set({
    payStatus: ORDER_PAY_STATUS.FAILED,
    status: ORDER_STATUS.FAILED,
    deliveryInfo: 'Trial request rejected',
    metaData: mergeTrialMeta(row.metaData, next),
  }).where(and(eq(orders.id, orderId), eq(orders.status, ORDER_STATUS.NONE)))
  if (getAffectedRows(rejected) === 0) {
    throw createError({ statusCode: 409, message: '试用申请状态已变化，请刷新后重试' })
  }
}
