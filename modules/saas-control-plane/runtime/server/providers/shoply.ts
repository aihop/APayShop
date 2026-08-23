
import type { SaasListResult, SaasProvider, StoredSaasConnection } from '../types'

const ALLOWED_QUERY_KEYS = new Set(['page', 'limit', 'keyword', 'status', 'storeStatus', 'keywordType'])

const makeUrl = (connection: StoredSaasConnection, path: string, query?: URLSearchParams) => {
  const base = connection.baseUrl.endsWith('/') ? connection.baseUrl : `${connection.baseUrl}/`
  const url = new URL(`app/saas/admin/${path}`, base)
  query?.forEach((value, key) => {
    if (ALLOWED_QUERY_KEYS.has(key) && value) url.searchParams.set(key, value)
  })
  return url
}

const request = async (
  connection: StoredSaasConnection,
  credential: string,
  path: string,
  query?: URLSearchParams,
) => {
  let response: Response
  try {
    response = await fetch(makeUrl(connection, path, query), {
      headers: {
        accept: 'application/json',
        'x-auth': credential,
        'x-store-id': '1',
      },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'The SaaS provider could not be reached' })
  }
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: `The SaaS provider returned HTTP ${response.status}` })
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!payload || Number(payload.code) !== 0) {
    throw createError({ statusCode: 502, statusMessage: 'The SaaS provider returned an invalid response' })
  }
  return payload.data
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const asList = (value: unknown): SaasListResult<Record<string, unknown>> => {
  if (Array.isArray(value)) return { list: value.map(asRecord), total: value.length }
  const record = asRecord(value)
  const candidate = [record.list, record.data, record.items].find(Array.isArray) as unknown[] | undefined
  const list = (candidate || []).map(asRecord)
  return { list, total: Number(record.total ?? record.count ?? list.length) }
}

const normalizeOverview = (value: unknown) => {
  const data = asRecord(value)
  return {
    totalTenants: Number(data.totalUsers ?? data.totalTenants ?? 0),
    newTenants: Number(data.newUsers ?? data.newTenants ?? 0),
    activeSubscriptions: Number(data.activeSubs ?? data.activeSubscriptions ?? 0),
    expiringSubscriptions: Number(data.expiringSubs ?? data.expiringSubscriptions ?? 0),
    monthlyRevenue: Number(data.monthlyRevenue ?? 0),
    previousMonthlyRevenue: Number(data.lastMonthRevenue ?? data.previousMonthlyRevenue ?? 0),
  }
}

const normalizeTenant = (item: Record<string, unknown>) => ({
  id: item.id,
  name: item.name ?? item.storeName,
  domain: item.domain,
  owner: item.member ?? item.email,
  plan: item.plan,
  status: item.accessStatus ?? item.status,
  subscriptionStatus: item.storeStatus,
  expiresAt: item.expiredAt,
  createdAt: item.createdAt,
})

const normalizePlan = (item: Record<string, unknown>) => ({
  id: item.id,
  name: item.name,
  code: item.code,
  price: item.price,
  currency: item.currency,
  interval: item.interval,
  intervalCount: item.intervalCount,
  status: item.status,
})

const normalizeSubscription = (item: Record<string, unknown>) => ({
  id: item.id,
  owner: item.memberEmail,
  tenantId: item.storeId ?? item.store_id,
  tenantName: item.storeName,
  plan: item.planName,
  amount: item.price,
  currency: item.currency,
  status: item.status,
  paymentStatus: item.paymentStatus,
  periodStart: item.currentPeriodStart,
  periodEnd: item.currentPeriodEnd,
})

export const shoplyProvider: SaasProvider = {
  code: 'shoply',
  name: 'Shoply',
  capabilities: ['overview', 'tenants', 'plans', 'subscriptions'],
  async test(connection, credential) {
    await request(connection, credential, 'dashboard/summary')
    return { message: 'Shoply connection is healthy' }
  },
  async overview(connection, credential) {
    return normalizeOverview(await request(connection, credential, 'dashboard/summary'))
  },
  async tenants(connection, credential, query) {
    const result = asList(await request(connection, credential, 'store/list', query))
    return { ...result, list: result.list.map(normalizeTenant) }
  },
  async plans(connection, credential, query) {
    const result = asList(await request(connection, credential, 'plan/list', query))
    return { ...result, list: result.list.map(normalizePlan) }
  },
  async subscriptions(connection, credential, query) {
    const result = asList(await request(connection, credential, 'subscription/list', query))
    return { ...result, list: result.list.map(normalizeSubscription) }
  },
}
