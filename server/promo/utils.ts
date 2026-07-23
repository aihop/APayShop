import crypto from 'crypto'

export const PROMO_ROLE = {
  MEMBER: 'member',
  AGENT: 'agent',
  MASTER_AGENT: 'master_agent',
} as const

export const PROMO_COMMISSION_TYPE = {
  INVITE_REWARD: 'invite_reward',
  AGENT_DISCOUNT: 'agent_discount',
  MASTER_OVERRIDE: 'master_override',
} as const

export const PROMO_SOURCE_TYPE = {
  DIRECT: 'direct',
  INVITE: 'invite',
  AGENT: 'agent',
  MIXED: 'mixed',
} as const

export const PROMO_COMMISSION_STATUS = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  SETTLED: 'settled',
  CANCELED: 'canceled',
} as const

export const PROMO_CODE_LENGTH = 6

export function generatePromoCode(length = PROMO_CODE_LENGTH) {
  return crypto.randomBytes(Math.max(4, Math.ceil(length / 2))).toString('hex').slice(0, length).toUpperCase()
}

export function toJsonValue<T>(value: T) {
  return process.env.NUXT_HUB_DATABASE ? value : JSON.stringify(value)
}

export function normalizeJson<T = Record<string, any>>(value: any, fallback: T): T {
  if (!value) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

export function firstPositiveNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    const next = Number(value)
    if (Number.isFinite(next) && next > 0) {
      return next
    }
  }
  return 0
}
