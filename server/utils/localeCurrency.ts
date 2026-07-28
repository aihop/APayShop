import { inArray } from 'drizzle-orm'
import { db } from '../db/runtime'
import { settings } from '../db/schema'

export interface LocaleCurrencyBinding {
  currency: string
  rate: number
}

export interface LocaleCurrencyQuote extends LocaleCurrencyBinding {
  locale: string
  baseCurrency: string
  baseAmount: number
  amount: number
  source: 'locale-binding' | 'default'
}

export function normalizeCurrencyCode(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback
}

export function normalizeLocaleCode(value: unknown): string {
  return String(value || '').trim().replace(/_/g, '-').toLowerCase()
}

export function parseLocaleCurrencyBindings(value: unknown): Record<string, LocaleCurrencyBinding> {
  let source: unknown = value
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return {}
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}

  const result: Record<string, LocaleCurrencyBinding> = {}
  for (const [rawLocale, rawBinding] of Object.entries(source)) {
    if (!rawBinding || typeof rawBinding !== 'object' || Array.isArray(rawBinding)) continue
    const locale = normalizeLocaleCode(rawLocale)
    const currency = normalizeCurrencyCode((rawBinding as any).currency)
    const rate = Number((rawBinding as any).rate)
    if (!locale || !currency || !Number.isFinite(rate) || rate <= 0) continue
    result[locale] = { currency, rate }
  }
  return result
}

export function roundCurrencyAmount(amount: number, currency: string): number {
  let fractionDigits = 2
  try {
    fractionDigits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {}
  const factor = 10 ** fractionDigits
  return Math.round((amount + Number.EPSILON) * factor) / factor
}

export async function buildLocaleCurrencyQuote(
  baseAmount: number,
  requestedLocale?: string | null,
): Promise<LocaleCurrencyQuote> {
  const rows = await db.select()
    .from(settings)
    .where(inArray(settings.key, ['currency', 'locale_currency_bindings']))
  const values = Object.fromEntries(rows.map((row: { key: string; value: string }) => [row.key, row.value]))
  const baseCurrency = normalizeCurrencyCode(values.currency, 'USD')
  const bindings = parseLocaleCurrencyBindings(values.locale_currency_bindings)
  const locale = normalizeLocaleCode(requestedLocale)
  const language = locale.split('-')[0] || ''
  const binding = bindings[locale] || bindings[language]
  const targetCurrency = binding?.currency || baseCurrency
  const rate = targetCurrency === baseCurrency ? 1 : binding?.rate || 1

  return {
    locale: locale || language,
    baseCurrency,
    baseAmount: roundCurrencyAmount(baseAmount, baseCurrency),
    currency: targetCurrency,
    rate,
    amount: roundCurrencyAmount(baseAmount * rate, targetCurrency),
    source: binding ? 'locale-binding' : 'default',
  }
}
