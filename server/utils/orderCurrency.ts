export interface OrderCurrencyInput {
  amount?: unknown
  currency?: unknown
  metaData?: unknown
}

export interface CurrencyAmountTotal {
  currency: string
  amount: number
}

const normalizeCurrency = (value: unknown, fallback = 'USD') => {
  const currency = String(value || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback
}

const normalizeMetaData = (value: unknown): Record<string, any> => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeAmount = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback
}

export function resolveOrderCurrencyAmounts(order: OrderCurrencyInput) {
  const paymentAmount = normalizeAmount(order.amount, 0)
  const paymentCurrency = normalizeCurrency(order.currency)
  const snapshot = normalizeMetaData(order.metaData).currencySnapshot
  const hasSnapshot = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
  const accountingAmount = hasSnapshot
    ? normalizeAmount(snapshot.baseAmount, paymentAmount)
    : paymentAmount
  const accountingCurrency = hasSnapshot
    ? normalizeCurrency(snapshot.baseCurrency, paymentCurrency)
    : paymentCurrency
  const exchangeRateValue = hasSnapshot ? Number(snapshot.exchangeRate) : 1

  return {
    paymentAmount,
    paymentCurrency,
    accountingAmount,
    accountingCurrency,
    exchangeRate: Number.isFinite(exchangeRateValue) && exchangeRateValue > 0 ? exchangeRateValue : 1,
    hasSnapshot: Boolean(hasSnapshot),
  }
}

export function aggregateOrderAccountingTotals(orderRows: OrderCurrencyInput[]): CurrencyAmountTotal[] {
  const totals = new Map<string, number>()
  for (const order of orderRows) {
    const { accountingAmount, accountingCurrency } = resolveOrderCurrencyAmounts(order)
    totals.set(accountingCurrency, (totals.get(accountingCurrency) || 0) + accountingAmount)
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function getCurrencyTotal(totals: CurrencyAmountTotal[], currency: string): number {
  const normalizedCurrency = normalizeCurrency(currency)
  return totals.find(item => item.currency === normalizedCurrency)?.amount || 0
}
