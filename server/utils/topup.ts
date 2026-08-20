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
  /** 余额的记账单位,与 user_wallets.cash_balance 同口径 */
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

/**
 * 兜底选项:只开放「用记账币种充值」,汇率恒为 1。
 * 区间/档位借用内置默认里同币种的配置,没有就用 USD 那套数字(只是金额范围,不涉汇率)。
 */
const fallbackAccountingOnlyOptions = (accountingCurrency: string): Record<string, TopupCurrencyOption> => {
  const base = DEFAULT_TOPUP_RULES.options[accountingCurrency] || DEFAULT_TOPUP_RULES.options.USD!
  return { [accountingCurrency]: { ...base, rate: 1 } }
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
  // 内置默认汇率是按「记账币种 = USD」设计的(USD:1, CNY:0.14)。记账币种改成别的之后
  // 这些默认值就失去意义了,不能再拿来兜底——见下面 missing rate 的处理。
  const defaultsMatchAccounting = accountingCurrency === DEFAULT_TOPUP_RULES.accountingCurrency
  const rawOptions = (stored.options && typeof stored.options === 'object') ? stored.options : {}
  const options: Record<string, TopupCurrencyOption> = {}
  for (const [code, raw] of Object.entries(rawOptions)) {
    const currency = normalizeCurrencyCode(code)
    if (!currency) continue

    // 记账币种自身的汇率恒为 1:这是「rate = 1 单位实付币种换多少记账单位」的定义,
    // 不是可配置项。此前它和其它币种一样从配置里读,把 accountingCurrency 改成 CNY
    // 却忘了把 CNY 的 rate 从默认 0.14 改成 1,就会静默按 0.14 折算(充 100 只到账 14),
    // 而订单/流水/余额三处会一致地记着这个错数,事后从数据上完全看不出来。
    // 覆写而不是校验:让这类错误结构上不可能存在,而不是发现后再报错。
    if (currency === accountingCurrency) {
      const base = normalizeOption(raw, DEFAULT_TOPUP_RULES.options[currency] || DEFAULT_TOPUP_RULES.options.USD!)
      options[currency] = { ...base, rate: 1 }
      continue
    }

    // 非记账币种缺 rate:在默认值不适用的记账币种下,无法推断汇率的币种一律不提供充值
    // (宁可少一个支付币种,也不能按 1:1 或按 USD 口径的默认值静默错算)。
    const hasExplicitRate = toFiniteNumber((raw as any)?.rate, 0) > 0
    if (!hasExplicitRate && !defaultsMatchAccounting) {
      console.warn(`[Topup] currency ${currency} has no rate under accounting currency ${accountingCurrency}, skipped`)
      continue
    }

    options[currency] = normalizeOption(raw, DEFAULT_TOPUP_RULES.options[currency] || DEFAULT_TOPUP_RULES.options.USD!)
  }

  return {
    enabled: stored.enabled !== false,
    accountingCurrency,
    // 配置里一个可用币种都没有时的兜底,避免误配置把充值入口整个锁死。
    // 注意不能无脑回落 DEFAULT_TOPUP_RULES.options:那套汇率是按 USD 记账设计的,
    // 在别的记账币种下会把上面刚堵住的错算又放回来。记账币种不同时,只保留
    // 「用本币充值、1:1 到账」——这条无需任何汇率假设,永远是对的。
    options: Object.keys(options).length > 0
      ? options
      : (defaultsMatchAccounting ? DEFAULT_TOPUP_RULES.options : fallbackAccountingOnlyOptions(accountingCurrency)),
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
export function buildTopupQuote(
  rules: TopupRules,
  currencyInput: unknown,
  amountInput: unknown,
  locale: 'zh' | 'en' = 'en'
): TopupQuote {
  const messages = locale === 'zh'
    ? {
        disabled: '充值功能暂未开启',
        unsupportedCurrency: (currency: string) => `不支持的充值币种：${currency || '(空)'}`,
        invalidAmount: '充值金额必须为正数',
        tooManyDecimals: '充值金额最多支持 2 位小数',
        amountRange: (min: number, max: number, currency: string) => `充值金额必须在 ${min} 到 ${max} ${currency} 之间`,
        invalidCreditAmount: '到账额度无效，请检查汇率设置',
      }
    : {
        disabled: 'Top-up is currently disabled',
        unsupportedCurrency: (currency: string) => `Unsupported top-up currency: ${currency || '(empty)'}`,
        invalidAmount: 'Top-up amount must be a positive number',
        tooManyDecimals: 'Top-up amount supports at most 2 decimal places',
        amountRange: (min: number, max: number, currency: string) => `Top-up amount must be between ${min} and ${max} ${currency}`,
        invalidCreditAmount: 'Resolved credit amount is invalid, please check the exchange rate setting',
      }
  if (!rules.enabled) {
    throw new TopupValidationError(messages.disabled)
  }

  const currency = normalizeCurrencyCode(currencyInput)
  const option = rules.options[currency]
  if (!currency || !option) {
    throw new TopupValidationError(messages.unsupportedCurrency(currency))
  }

  const amount = Number(amountInput)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TopupValidationError(messages.invalidAmount)
  }
  // 币种最小单位:挡住 0.001 这类脏金额,也避免折算后出现记账尾数
  const normalizedAmount = roundMoney(amount)
  if (normalizedAmount !== amount) {
    throw new TopupValidationError(messages.tooManyDecimals)
  }
  if (normalizedAmount < option.min || normalizedAmount > option.max) {
    throw new TopupValidationError(messages.amountRange(option.min, option.max, currency))
  }

  const rechargeAmount = roundMoney(normalizedAmount * option.rate)
  if (!(rechargeAmount > 0)) {
    throw new TopupValidationError(messages.invalidCreditAmount)
  }

  return {
    currency,
    amount: normalizedAmount,
    rechargeAmount,
    accountingCurrency: rules.accountingCurrency,
  }
}

/**
 * 从支付插件 configJson 推断可接受的订单币种。
 *
 * 普通插件通常只声明 currency/sourceCurrency/priceCurrency 之一；转换型插件
 * 还会声明 settlementCurrency，并可同时接受源币种和结算币种。未声明时继续
 * 按历史兼容模式放行。
 */
export function resolvePaymentMethodCurrencies(configJson: any): string[] {
  if (!configJson || typeof configJson !== 'object') return []
  return Array.from(new Set([
    configJson.currency,
    configJson.sourceCurrency,
    configJson.priceCurrency,
    configJson.settlementCurrency,
  ].map(normalizeCurrencyCode).filter(Boolean)))
}

export function isPaymentMethodCurrencySupported(configJson: any, orderCurrency: unknown): boolean {
  const supportedCurrencies = resolvePaymentMethodCurrencies(configJson)
  if (supportedCurrencies.length === 0) return true
  return supportedCurrencies.includes(normalizeCurrencyCode(orderCurrency))
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
