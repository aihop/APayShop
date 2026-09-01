import crypto from 'node:crypto'
import { createError, getRequestURL } from 'h3'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/runtime'
import { orders, products, settings } from '../db/schema'
import { resolveOrderCurrencyAmounts } from './orderCurrency'

const CHECKOUT_SECRET_SETTING_KEY = 'minimal_checkout_secret'
const CHECKOUT_CONFIG_NOTIFY_URL_KEY = 'minimal_checkout_default_notify_url'
const CHECKOUT_CONFIG_RETURN_URL_KEY = 'minimal_checkout_default_return_url'
const CHECKOUT_CONFIG_CANCEL_URL_KEY = 'minimal_checkout_default_cancel_url'
const CHECKOUT_SIGNATURE_TTL_MS = 5 * 60 * 1000
const CHECKOUT_TOKEN_TTL_MS = 30 * 60 * 1000
export const MINIMAL_CHECKOUT_SOURCE = 'minimal_checkout'
export const MINIMAL_CHECKOUT_CARRIER_SLUG = 'minimal-checkout-recharge'

let cachedCheckoutSecret: string | null = null
let lastCheckoutSecretReadAt = 0
let cachedAdminConfig: MinimalCheckoutAdminConfig | null = null
let lastAdminConfigReadAt = 0
const SETTINGS_CACHE_TTL = 5000

export interface MinimalCheckoutTokenPayload {
  orderId: string
  visitorId: string
  exp: number
}

export interface MinimalCheckoutBridgeMeta {
  source: 'minimal_checkout'
  version?: 2
  processingMode?: 'relay_topup'
  externalOrderId: string
  sourceProductId?: number
  amount?: number
  currency?: string
  sourceAmount?: number
  sourceCurrency?: string
  exchangeRate?: number
  rechargeAmount?: number
  rechargeCurrency?: string
  balanceType?: 'cash' | 'grant'
  notifyUrl?: string
  returnUrl?: string
  cancelUrl?: string
  customerEmail?: string
  attach?: Record<string, any>
  notify?: {
    status: 'success' | 'failed'
    attemptCount?: number
    attemptedAt: string
    deliveredAt?: string
    httpStatus?: number | null
  }
  createdAt: string
}

export interface MinimalCheckoutAdminConfig {
  defaultNotifyUrl: string
  defaultReturnUrl: string
  defaultCancelUrl: string
}

export interface MinimalCheckoutSignatureOptions {
  path: string
  method?: string
  rawBody?: string
  timestamp?: string | number
  secret?: string
}

export interface MinimalCheckoutSignatureResult {
  timestamp: string
  signature: string
  headers: Record<'x-apay-timestamp' | 'x-apay-signature', string>
}

type MinimalCheckoutOrderLookup = {
  id: string
  amount: number
  productId: number
  contactEmail: string
  payMethod?: string | null
  tradeNo?: string | null
  status?: string | null
  payStatus?: string | null
  visitorId?: string | null
  createdAt?: Date | number | null
  paidAt?: Date | number | null
  metaData?: unknown
  source?: string | null
  externalOrderId?: string | null
}

const resolveDialect = () => {
  const explicitDialect = process.env.DB_DIALECT?.replace(/"/g, '').toLowerCase()
  if (explicitDialect === 'postgresql' || explicitDialect === 'mysql' || explicitDialect === 'sqlite') {
    return explicitDialect
  }

  const connectionUrl =
    process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRESQL_URL
    || process.env.NUXT_DATABASE_URL
    || process.env.LIBSQL_URL
    || ''

  if (connectionUrl.startsWith('postgres://') || connectionUrl.startsWith('postgresql://')) {
    return 'postgresql'
  }

  if (connectionUrl.startsWith('mysql://')) {
    return 'mysql'
  }

  return 'sqlite'
}

const shouldStoreJsonAsObject = () => {
  if (process.env.NUXT_HUB_DATABASE) return true
  const dialect = resolveDialect()
  return dialect === 'postgresql' || dialect === 'mysql'
}

const toBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url')
const fromBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const createDigest = (secret: string, value: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex')

const compareDigest = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

const sortUrlSearch = (url: URL) => {
  const sorted = new URLSearchParams()
  const entries = [...url.searchParams.entries()]
    .filter(([key]) => key !== 'signature')
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue)
      return leftKey.localeCompare(rightKey)
    })

  for (const [key, value] of entries) {
    sorted.append(key, value)
  }

  const query = sorted.toString()
  return query ? `?${query}` : ''
}

const buildSortedPathWithQuery = (path: string) => {
  const url = new URL(path, 'https://minimal-checkout.local')
  return `${url.pathname}${sortUrlSearch(url)}`
}

const buildSignatureBaseFromParts = (method: string, path: string, rawBody = '') => {
  const bodyHash = crypto.createHash('sha256').update(rawBody || '').digest('hex')
  return [
    String(method || 'GET').toUpperCase(),
    buildSortedPathWithQuery(path),
    bodyHash,
  ].join('\n')
}

const buildSignatureBase = (event: any, rawBody = '') => {
  const requestUrl = getRequestURL(event)
  return buildSignatureBaseFromParts(
    String(event.node.req.method || 'GET'),
    `${requestUrl.pathname}${requestUrl.search}`,
    rawBody,
  )
}

const normalizeCheckoutUrl = (value: unknown) => {
  const candidate = String(value || '').trim()
  if (!candidate) return ''
  try {
    return new URL(candidate).toString()
  } catch {
    return ''
  }
}

const normalizeMinimalCheckoutAdminConfig = (value: unknown): MinimalCheckoutAdminConfig => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
  return {
    defaultNotifyUrl: normalizeCheckoutUrl(raw.defaultNotifyUrl),
    defaultReturnUrl: normalizeCheckoutUrl(raw.defaultReturnUrl),
    defaultCancelUrl: normalizeCheckoutUrl(raw.defaultCancelUrl),
  }
}

export const getMinimalCheckoutSecret = async () => {
  const now = Date.now()
  if (cachedCheckoutSecret && now - lastCheckoutSecretReadAt < SETTINGS_CACHE_TTL) {
    return cachedCheckoutSecret
  }

  const rows = await db.select().from(settings).where(eq(settings.key, CHECKOUT_SECRET_SETTING_KEY)).limit(1)
  const fromSettings = rows[0]?.value?.trim()
  const fromEnv = process.env.MINIMAL_CHECKOUT_SECRET?.trim()
  const secret = fromSettings || fromEnv || ''

  cachedCheckoutSecret = secret || null
  lastCheckoutSecretReadAt = now
  return cachedCheckoutSecret
}

export const upsertMinimalCheckoutSecret = async (secret: string) => {
  const value = String(secret || '').trim()
  const existing = await db.select().from(settings).where(eq(settings.key, CHECKOUT_SECRET_SETTING_KEY)).limit(1)

  if (existing.length > 0) {
    await db.update(settings)
      .set({ value })
      .where(eq(settings.key, CHECKOUT_SECRET_SETTING_KEY))
  } else {
    await db.insert(settings).values({
      key: CHECKOUT_SECRET_SETTING_KEY,
      value,
      description: 'Shared secret for minimal checkout bridge',
    })
  }

  cachedCheckoutSecret = value || null
  lastCheckoutSecretReadAt = Date.now()
}

const upsertSettingByKey = async (key: string, value: string, description?: string) => {
  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value, description })
  }
}

export const getMinimalCheckoutAdminConfig = async (): Promise<MinimalCheckoutAdminConfig> => {
  const now = Date.now()
  if (cachedAdminConfig && now - lastAdminConfigReadAt < SETTINGS_CACHE_TTL) {
    return cachedAdminConfig
  }

  const keys = [
    CHECKOUT_CONFIG_NOTIFY_URL_KEY,
    CHECKOUT_CONFIG_RETURN_URL_KEY,
    CHECKOUT_CONFIG_CANCEL_URL_KEY,
  ]
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }

  const config = normalizeMinimalCheckoutAdminConfig({
    defaultNotifyUrl: map[CHECKOUT_CONFIG_NOTIFY_URL_KEY],
    defaultReturnUrl: map[CHECKOUT_CONFIG_RETURN_URL_KEY],
    defaultCancelUrl: map[CHECKOUT_CONFIG_CANCEL_URL_KEY],
  })

  cachedAdminConfig = config
  lastAdminConfigReadAt = now
  return config
}

export const saveMinimalCheckoutAdminConfig = async (
  input: Partial<MinimalCheckoutAdminConfig>,
): Promise<MinimalCheckoutAdminConfig> => {
  const normalized = normalizeMinimalCheckoutAdminConfig(input)

  await Promise.all([
    upsertSettingByKey(
      CHECKOUT_CONFIG_NOTIFY_URL_KEY,
      normalized.defaultNotifyUrl,
      'Default notify URL for minimal checkout',
    ),
    upsertSettingByKey(
      CHECKOUT_CONFIG_RETURN_URL_KEY,
      normalized.defaultReturnUrl,
      'Default return URL for minimal checkout',
    ),
    upsertSettingByKey(
      CHECKOUT_CONFIG_CANCEL_URL_KEY,
      normalized.defaultCancelUrl,
      'Default cancel URL for minimal checkout',
    ),
  ])

  cachedAdminConfig = normalized
  lastAdminConfigReadAt = Date.now()
  return normalized
}

export const assertMinimalCheckoutSignature = async (event: any, rawBody = '') => {
  const secret = await getMinimalCheckoutSecret()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Minimal checkout secret is not configured' })
  }

  const timestamp = String(
    event.node.req.headers['x-apay-timestamp']
    || ''
  ).trim()
  const signature = String(
    event.node.req.headers['x-apay-signature']
    || ''
  ).trim().toLowerCase()

  if (!timestamp || !signature) {
    throw createError({ statusCode: 401, statusMessage: 'Missing checkout signature headers' })
  }

  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid checkout signature timestamp' })
  }

  if (Math.abs(Date.now() - numericTimestamp) > CHECKOUT_SIGNATURE_TTL_MS) {
    throw createError({ statusCode: 401, statusMessage: 'Checkout signature has expired' })
  }

  const signatureBase = buildSignatureBase(event, rawBody)
  const expected = createDigest(secret, `${timestamp}\n${signatureBase}`)
  if (!compareDigest(expected, signature)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid checkout signature' })
  }
}

export const createMinimalCheckoutSignature = async (
  options: MinimalCheckoutSignatureOptions,
): Promise<MinimalCheckoutSignatureResult> => {
  const secret = String(options.secret || '').trim() || await getMinimalCheckoutSecret()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Minimal checkout secret is not configured' })
  }

  const timestamp = String(options.timestamp || Date.now()).trim()
  const signatureBase = buildSignatureBaseFromParts(
    String(options.method || 'GET'),
    options.path,
    options.rawBody || '',
  )
  const signature = createDigest(secret, `${timestamp}\n${signatureBase}`)

  return {
    timestamp,
    signature,
    headers: {
      'x-apay-timestamp': timestamp,
      'x-apay-signature': signature,
    },
  }
}

export const createMinimalCheckoutToken = async (payload: Omit<MinimalCheckoutTokenPayload, 'exp'> & { exp?: number }) => {
  const secret = await getMinimalCheckoutSecret()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Minimal checkout secret is not configured' })
  }

  const tokenPayload: MinimalCheckoutTokenPayload = {
    orderId: payload.orderId,
    visitorId: payload.visitorId,
    exp: payload.exp || Date.now() + CHECKOUT_TOKEN_TTL_MS,
  }
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload))
  const signature = createDigest(secret, encodedPayload)
  return `${encodedPayload}.${signature}`
}

export const verifyMinimalCheckoutToken = async (token: string) => {
  const secret = await getMinimalCheckoutSecret()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Minimal checkout secret is not configured' })
  }

  const [encodedPayload, signature] = String(token || '').split('.')
  if (!encodedPayload || !signature) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid checkout token' })
  }

  const expected = createDigest(secret, encodedPayload)
  if (!compareDigest(expected, signature)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid checkout token signature' })
  }

  let payload: MinimalCheckoutTokenPayload
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid checkout token payload' })
  }

  if (!payload.orderId || !payload.visitorId || !payload.exp) {
    throw createError({ statusCode: 400, statusMessage: 'Checkout token payload is incomplete' })
  }

  if (payload.exp < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Checkout token has expired' })
  }

  return payload
}

export const generateCheckoutVisitorId = () => `checkout_${crypto.randomUUID().replace(/-/g, '')}`

export const generateMinimalCheckoutOrderId = (productType?: string) => {
  const prefix = String(productType || 'OT').slice(0, 2).toUpperCase()
  const date = new Date()
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const timeSuffix = String(Date.now()).slice(-6)
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `${prefix}${dateStr}${timeSuffix}${randomHex}`
}

export const ensureMinimalCheckoutCarrierProduct = async () => {
  const existing = await db.select().from(products)
    .where(eq(products.slug, MINIMAL_CHECKOUT_CARRIER_SLUG))
    .limit(1)
  if (existing.length > 0) return existing[0]!

  const metaData = {
    system: true,
    relay: true,
    display_unit: 'credits',
    balance_type: 'cash',
    integration: { transaction: { enabled: false } },
  }

  try {
    const inserted = await db.insert(products).values({
      slug: MINIMAL_CHECKOUT_CARRIER_SLUG,
      name: 'Minimal Checkout Recharge',
      price: 0,
      type: 'topup',
      description: 'Hidden carrier for minimal checkout relay orders.',
      isActive: false,
      metaData: (shouldStoreJsonAsObject() ? metaData : JSON.stringify(metaData)) as any,
    }).returning()
    if (inserted.length > 0) return inserted[0]!
  } catch (error) {
    console.warn('[minimal-checkout] Carrier insert raced, re-reading:', error)
  }

  const reread = await db.select().from(products)
    .where(eq(products.slug, MINIMAL_CHECKOUT_CARRIER_SLUG))
    .limit(1)
  if (!reread.length) {
    throw new Error('Failed to provision minimal checkout carrier product')
  }
  return reread[0]!
}

export const normalizeOrderMetaData = (value: unknown): Record<string, any> => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export const buildMinimalCheckoutBridgeMeta = (input: {
  externalOrderId: string
  sourceProductId?: number
  amount?: number
  currency?: string
  sourceAmount?: number
  sourceCurrency?: string
  exchangeRate?: number
  rechargeAmount?: number
  rechargeCurrency?: string
  balanceType?: 'cash' | 'grant'
  notifyUrl?: string
  returnUrl?: string
  cancelUrl?: string
  customerEmail?: string
  attach?: Record<string, any>
}) => ({
  source: MINIMAL_CHECKOUT_SOURCE,
  version: 2,
  processingMode: 'relay_topup',
  externalOrderId: input.externalOrderId,
  sourceProductId: input.sourceProductId,
  amount: typeof input.amount === 'number' ? input.amount : undefined,
  currency: input.currency,
  sourceAmount: typeof input.sourceAmount === 'number' ? input.sourceAmount : undefined,
  sourceCurrency: input.sourceCurrency,
  exchangeRate: typeof input.exchangeRate === 'number' ? input.exchangeRate : undefined,
  rechargeAmount: typeof input.rechargeAmount === 'number' ? input.rechargeAmount : undefined,
  rechargeCurrency: input.rechargeCurrency,
  balanceType: input.balanceType,
  notifyUrl: input.notifyUrl,
  returnUrl: input.returnUrl,
  cancelUrl: input.cancelUrl,
  customerEmail: input.customerEmail,
  attach: input.attach,
  createdAt: new Date().toISOString(),
} satisfies MinimalCheckoutBridgeMeta)

export const mergeMinimalCheckoutMeta = (value: unknown, bridge: MinimalCheckoutBridgeMeta) => {
  const meta = normalizeOrderMetaData(value)
  return {
    ...meta,
    checkoutBridge: bridge,
  }
}

export const readMinimalCheckoutBridgeMeta = (value: unknown): MinimalCheckoutBridgeMeta | null => {
  const meta = normalizeOrderMetaData(value)
  const bridge = meta.checkoutBridge
  if (!bridge || typeof bridge !== 'object' || Array.isArray(bridge)) return null
  if (bridge.source !== MINIMAL_CHECKOUT_SOURCE || !bridge.externalOrderId) return null
  return bridge as MinimalCheckoutBridgeMeta
}

export const isMinimalCheckoutRelayOrder = (order?: { source?: string | null; metaData?: unknown } | null): boolean => {
  if (!order || order.source !== MINIMAL_CHECKOUT_SOURCE) return false
  const bridge = readMinimalCheckoutBridgeMeta(order.metaData)
  if (!bridge) return false
  if (bridge.attach?.channel === 'storefront') return false
  if (bridge.attach?.businessType === 'subscription') return false
  return true
}

export const findMinimalCheckoutOrderByExternalId = async (externalOrderId: string) => {
  const normalizedExternalOrderId = String(externalOrderId || '').trim()
  if (!normalizedExternalOrderId) return null

  const indexedRows = await db.select({
    id: orders.id,
    amount: orders.amount,
    productId: orders.productId,
    contactEmail: orders.contactEmail,
    payMethod: orders.payMethod,
    tradeNo: orders.tradeNo,
    status: orders.status,
    payStatus: orders.payStatus,
    visitorId: orders.visitorId,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    metaData: orders.metaData,
    source: orders.source,
    externalOrderId: orders.externalOrderId,
  }).from(orders).where(and(
    eq(orders.source, MINIMAL_CHECKOUT_SOURCE),
    eq(orders.externalOrderId, normalizedExternalOrderId),
  )).limit(1)

  if (indexedRows[0]) {
    const bridge = readMinimalCheckoutBridgeMeta(indexedRows[0].metaData)
    if (bridge) {
      return {
        ...indexedRows[0],
        bridgeMeta: bridge,
      } satisfies MinimalCheckoutOrderLookup & { bridgeMeta: MinimalCheckoutBridgeMeta }
    }
  }

  const recentOrders = await db.select({
    id: orders.id,
    amount: orders.amount,
    productId: orders.productId,
    contactEmail: orders.contactEmail,
    payMethod: orders.payMethod,
    tradeNo: orders.tradeNo,
    status: orders.status,
    payStatus: orders.payStatus,
    visitorId: orders.visitorId,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    metaData: orders.metaData,
  })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(2000)

  for (const order of recentOrders) {
    const bridge = readMinimalCheckoutBridgeMeta(order.metaData)
    if (bridge?.externalOrderId === normalizedExternalOrderId) {
      return {
        ...order,
        bridgeMeta: bridge,
      } satisfies MinimalCheckoutOrderLookup & { bridgeMeta: MinimalCheckoutBridgeMeta }
    }
  }

  return null
}

export const findMinimalCheckoutOrderById = async (orderId: string) => {
  const normalizedOrderId = String(orderId || '').trim()
  if (!normalizedOrderId) return null

  const rows = await db.select({
    id: orders.id,
    amount: orders.amount,
    productId: orders.productId,
    contactEmail: orders.contactEmail,
    payMethod: orders.payMethod,
    tradeNo: orders.tradeNo,
    status: orders.status,
    payStatus: orders.payStatus,
    visitorId: orders.visitorId,
    createdAt: orders.createdAt,
    paidAt: orders.paidAt,
    metaData: orders.metaData,
    source: orders.source,
    externalOrderId: orders.externalOrderId,
  })
    .from(orders)
    .where(eq(orders.id, normalizedOrderId))
    .limit(1)

  const order = rows[0]
  if (!order) return null
  const bridge = readMinimalCheckoutBridgeMeta(order.metaData)
  if (!bridge) return null

  return {
    ...order,
    bridgeMeta: bridge,
  } satisfies MinimalCheckoutOrderLookup & { bridgeMeta: MinimalCheckoutBridgeMeta }
}

export const prepareOrderMetaForInsert = (value: Record<string, any>) =>
  shouldStoreJsonAsObject() ? value : JSON.stringify(value)

export const signMinimalCheckoutPayload = async (timestamp: string, rawBody: string) => {
  const secret = await getMinimalCheckoutSecret()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Minimal checkout secret is not configured' })
  }

  return createDigest(secret, `${timestamp}\n${rawBody}`)
}

const firstPositiveNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 0
}

export const fulfillMinimalCheckoutRelay = async (orderId: string) => {
  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const order = orderRows[0]
  if (!order) return false

  const orderMeta = normalizeOrderMetaData(order.metaData)
  const bridge = readMinimalCheckoutBridgeMeta(orderMeta)
  if (!bridge) return false

  const carrierRows = await db.select().from(products).where(eq(products.id, order.productId)).limit(1)
  const carrier = carrierRows[0]
  const sourceProductRows = bridge.sourceProductId
    ? await db.select().from(products).where(eq(products.id, bridge.sourceProductId)).limit(1)
    : []
  const sourceProduct = sourceProductRows[0] || carrier
  if (!sourceProduct) return false

  const attach = bridge.attach && typeof bridge.attach === 'object' && !Array.isArray(bridge.attach)
    ? bridge.attach
    : {}
  const attachedProductMeta = attach.productMeta && typeof attach.productMeta === 'object' && !Array.isArray(attach.productMeta)
    ? attach.productMeta
    : null
  const sourceProductMeta = attachedProductMeta || normalizeOrderMetaData(sourceProduct.metaData)
  const currencyAmounts = resolveOrderCurrencyAmounts(order)
  const rechargeAmount = firstPositiveNumber(
    bridge.rechargeAmount,
    orderMeta.recharge_amount,
    sourceProductMeta.recharge_amount,
    bridge.sourceAmount,
    currencyAmounts.accountingAmount,
  )
  const rechargeCurrency = String(
    bridge.rechargeCurrency
      || orderMeta.display_unit
      || sourceProductMeta.display_unit
      || bridge.sourceCurrency
      || currencyAmounts.accountingCurrency,
  ).trim().toUpperCase()
  const balanceType = String(
    bridge.balanceType
      || orderMeta.balance_type
      || sourceProductMeta.balance_type
      || 'cash',
  ).trim().toLowerCase() === 'grant' ? 'grant' : 'cash'
  const isApayWallet = attach.walletOwner === 'apay'
  const deliveryInfo = isApayWallet
    ? `Payment confirmed. ${rechargeAmount} ${rechargeCurrency} credited to the APay wallet.`
    : `Payment relayed. ${rechargeAmount} ${rechargeCurrency} pending downstream credit confirmation.`

  await db.update(orders).set({
    status: 'delivered',
    deliveryInfo,
  }).where(eq(orders.id, orderId))

  const productName = String(attach.productName || sourceProduct.name || 'Recharge').trim()
  const productType = String(attach.businessType || sourceProduct.type || 'topup').trim()

  return {
    ...order,
    metaData: orderMeta,
    status: 'delivered',
    deliveryInfo,
    accountingAmount: rechargeAmount,
    accountingCurrency: rechargeCurrency,
    product: {
      id: bridge.sourceProductId || sourceProduct.id,
      slug: sourceProduct.slug || '',
      name: productName,
      type: productType,
      price: bridge.sourceAmount ?? sourceProduct.price,
      metaData: sourceProductMeta,
    },
    integration: {
      transaction: {
        enabled: !isApayWallet && rechargeAmount > 0,
        type: 'topup',
        balance_type: balanceType,
        direction: 'credit',
        amount: rechargeAmount,
        source_id: bridge.externalOrderId,
        remark: `${productName} payment credited through APay`,
        metadata: {
          order_id: order.id,
          external_order_id: bridge.externalOrderId,
          business_type: productType,
          accounting_currency: rechargeCurrency,
          payment_amount: order.amount,
          payment_currency: order.currency,
          source_amount: bridge.sourceAmount ?? null,
          source_currency: bridge.sourceCurrency || null,
          exchange_rate: bridge.exchangeRate ?? null,
        },
      },
    },
  }
}
