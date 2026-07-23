import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { products, settings } from '../db/schema'

/**
 * 快捷充值规则单点。
 *
 * 设计要点(2026-07):
 * - 金额权威在服务端。前端只提交「想充多少 + 用哪个币种」,区间校验、汇率折算、
 *   到账额度全部在这里算完再写进订单,客户端传来的 recharge_amount 一律丢弃
 *   (见 utils/orderMetaData.ts 的保留键机制)。
 * - 站点是混合币种(支付宝/微信=CNY,Stripe/PayPal=USD),但余额只有一个记账
 *   单位。因此订单记「实付币种 + 实付金额」,到账额度按 rate 折算成记账单位。
 * - 不新增订单表:orders.product_id 是 NOT NULL 外键,且履约/回调/归因/后台
 *   全链路都假设商品存在。快捷充值挂在一个隐藏的载体 SKU 上(isActive=false,
 *   前台列表按 is_active 过滤,自然不可见),可变金额走订单级 recharge_amount。
 */

export const TOPUP_CARRIER_SLUG = 'quick-topup'

export interface TopupCurrencyOption {
  /** 单笔最小实付金额(原币) */
  min: number
  /** 单笔最大实付金额(原币) */
  max: number
  /** 前端快捷按钮档位(原币),仅为展示,不参与校验 */
  presets: number[]
  /** 1 单位实付币种 = 多少记账单位;记账币种自身为 1 */
  rate: number
}

export interface TopupRules {
  enabled: boolean
  /** 余额的记账单位,与 users.CashBalance 同口径 */
  accountingCurrency: string
  options: Record<string, TopupCurrencyOption>
}

const DEFAULT_TOPUP_RULES: TopupRules = {
  enabled: true,
  accountingCurrency: 'USD',
  options: {
    USD: { min: 1, max: 10000, presets: [10, 50, 100, 200], rate: 1 },
    CNY: { min: 10, max: 50000, presets: [50, 100, 500, 1000], rate: 0.14 },
  },
}

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 金额按记账精度归一(2 位小数),避免浮点尾数进入记账事件 */
const roundMoney = (value: number): number => Math.round(value * 100) / 100

const normalizeCurrencyCode = (value: unknown): string => String(value || '').trim().toUpperCase()

const normalizeOption = (raw: any, fallback: TopupCurrencyOption): TopupCurrencyOption => {
  const min = Math.max(0, toFiniteNumber(raw?.min, fallback.min))
  const max = Math.max(min, toFiniteNumber(raw?.max, fallback.max))
  const rate = toFiniteNumber(raw?.rate, fallback.rate)
  const presets = Array.isArray(raw?.presets)
    ? raw.presets.map((item: unknown) => toFiniteNumber(item, 0)).filter((item: number) => item >= min && item <= max)
    : fallback.presets
  return { min, max, presets, rate: rate > 0 ? rate : fallback.rate }
}

/** 读取并归一 settings.topup_rules;缺配置或配置损坏时回落内置默认值 */
export async function getTopupRules(): Promise<TopupRules> {
  let stored: any = null
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, 'topup_rules')).limit(1)
    if (rows.length > 0 && rows[0].value) {
      stored = JSON.parse(rows[0].value)
    }
  } catch (error) {
    console.error('[Topup] Failed to read topup_rules setting, falling back to defaults:', error)
  }

  if (!stored || typeof stored !== 'object') return DEFAULT_TOPUP_RULES

  const accountingCurrency = normalizeCurrencyCode(stored.accountingCurrency) || DEFAULT_TOPUP_RULES.accountingCurrency
  const rawOptions = (stored.options && typeof stored.options === 'object') ? stored.options : {}
  const options: Record<string, TopupCurrencyOption> = {}
  for (const [code, raw] of Object.entries(rawOptions)) {
    const currency = normalizeCurrencyCode(code)
    if (!currency) continue
    options[currency] = normalizeOption(raw, DEFAULT_TOPUP_RULES.options[currency] || DEFAULT_TOPUP_RULES.options.USD!)
  }

  return {
    enabled: stored.enabled !== false,
    accountingCurrency,
    // 配置里一个币种都没有时回落默认,避免误配置把充值入口整个锁死
    options: Object.keys(options).length > 0 ? options : DEFAULT_TOPUP_RULES.options,
  }
}

export interface TopupQuote {
  /** 实付币种 */
  currency: string
  /** 实付金额(原币),写入 orders.amount */
  amount: number
  /** 到账额度(记账单位),写入 order.metaData.recharge_amount */
  rechargeAmount: number
  accountingCurrency: string
}

export class TopupValidationError extends Error {}

/**
 * 校验并折算一笔充值。任何非法输入都抛 TopupValidationError,
 * 调用方转成 4xx——绝不允许「校验失败但继续建单」。
 */
export function buildTopupQuote(rules: TopupRules, currencyInput: unknown, amountInput: unknown): TopupQuote {
  if (!rules.enabled) {
    throw new TopupValidationError('Top-up is currently disabled')
  }

  const currency = normalizeCurrencyCode(currencyInput)
  const option = rules.options[currency]
  if (!currency || !option) {
    throw new TopupValidationError(`Unsupported top-up currency: ${currency || '(empty)'}`)
  }

  const amount = Number(amountInput)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TopupValidationError('Top-up amount must be a positive number')
  }
  // 币种最小单位:挡住 0.001 这类脏金额,也避免折算后出现记账尾数
  const normalizedAmount = roundMoney(amount)
  if (normalizedAmount !== amount) {
    throw new TopupValidationError('Top-up amount supports at most 2 decimal places')
  }
  if (normalizedAmount < option.min || normalizedAmount > option.max) {
    throw new TopupValidationError(`Top-up amount must be between ${option.min} and ${option.max} ${currency}`)
  }

  const rechargeAmount = roundMoney(normalizedAmount * option.rate)
  if (!(rechargeAmount > 0)) {
    throw new TopupValidationError('Resolved credit amount is invalid, please check the exchange rate setting')
  }

  return {
    currency,
    amount: normalizedAmount,
    rechargeAmount,
    accountingCurrency: rules.accountingCurrency,
  }
}

/**
 * 从支付插件 configJson 推断结算币种。
 *
 * 各插件字段名不统一(currency / sourceCurrency / priceCurrency),且 alipay、
 * paypal、lemonsqueezy 等压根没声明。推断不出来时返回 null,调用方必须按
 * 「放行」处理——宁可漏拦也不能把没声明币种的插件全部锁死。
 */
export function resolvePaymentMethodCurrency(configJson: any): string | null {
  if (!configJson || typeof configJson !== 'object') return null
  const raw = configJson.currency ?? configJson.sourceCurrency ?? configJson.priceCurrency
  const normalized = normalizeCurrencyCode(raw)
  return normalized || null
}

/**
 * 取得快捷充值的载体商品(隐藏 SKU),不存在则创建。
 * isActive=false 让它不进前台商品列表(server/api/products/index.get.ts 按
 * is_active 过滤),metaData.system 供后台列表过滤。
 */
export async function ensureTopupCarrierProduct() {
  const existing = await db.select().from(products).where(eq(products.slug, TOPUP_CARRIER_SLUG)).limit(1)
  if (existing.length > 0) return existing[0]!

  const metaDataObj = {
    system: true,
    display_unit: 'credits',
    balance_type: 'cash',
  }

  try {
    const inserted = await db.insert(products).values({
      slug: TOPUP_CARRIER_SLUG,
      name: 'Quick Top-up',
      price: 0,
      type: 'topup',
      description: 'System carrier SKU for quick top-up. Amount is resolved per order.',
      isActive: false,
      // D1 需原生对象,本地 SQLite 需字符串(AGENTS §6.A)
      metaData: (process.env.NUXT_HUB_DATABASE ? metaDataObj : JSON.stringify(metaDataObj)) as any,
    }).returning()
    if (inserted.length > 0) return inserted[0]!
  } catch (error) {
    // slug 唯一索引:并发首次充值会有一方插入失败,回查即可
    console.warn('[Topup] Carrier product insert raced, re-reading:', error)
  }

  const reread = await db.select().from(products).where(eq(products.slug, TOPUP_CARRIER_SLUG)).limit(1)
  if (!reread.length) {
    throw new Error('Failed to provision top-up carrier product')
  }
  return reread[0]!
}
