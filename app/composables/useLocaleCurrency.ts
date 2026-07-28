import { computed } from 'vue'

interface LocaleCurrencyBinding {
  currency: string
  rate: number
}

const normalizeCurrencyCode = (value: unknown, fallback = '') => {
  const currency = String(value || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback
}

const normalizeLocaleCode = (value: unknown) => String(value || '')
  .trim()
  .replace(/_/g, '-')
  .toLowerCase()

const parseBindings = (value: unknown): Record<string, LocaleCurrencyBinding> => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const bindings: Record<string, LocaleCurrencyBinding> = {}
    for (const [rawLocale, rawBinding] of Object.entries(parsed)) {
      if (!rawBinding || typeof rawBinding !== 'object' || Array.isArray(rawBinding)) continue
      const locale = normalizeLocaleCode(rawLocale)
      const currency = normalizeCurrencyCode((rawBinding as any).currency)
      const rate = Number((rawBinding as any).rate)
      if (locale && currency && Number.isFinite(rate) && rate > 0) {
        bindings[locale] = { currency, rate }
      }
    }
    return bindings
  } catch {
    return {}
  }
}

export const useLocaleCurrency = () => {
  const { locale } = useI18n()
  const { getSetting } = useSettings()

  const baseCurrency = computed(() => normalizeCurrencyCode(getSetting('currency', 'USD'), 'USD'))
  const bindings = computed(() => parseBindings(getSetting('locale_currency_bindings', '{}')))
  const binding = computed(() => {
    const currentLocale = normalizeLocaleCode(locale.value)
    const language = currentLocale.split('-')[0] || ''
    return bindings.value[currentLocale] || bindings.value[language] || null
  })
  const currency = computed(() => binding.value?.currency || baseCurrency.value)
  const exchangeRate = computed(() => currency.value === baseCurrency.value ? 1 : binding.value?.rate || 1)

  const convertAmount = (baseAmount: unknown) => {
    const amount = Number(baseAmount || 0) * exchangeRate.value
    let fractionDigits = 2
    try {
      fractionDigits = new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: currency.value,
      }).resolvedOptions().maximumFractionDigits ?? 2
    } catch {}
    const factor = 10 ** fractionDigits
    return Math.round((amount + Number.EPSILON) * factor) / factor
  }

  const formatAmount = (baseAmount: unknown) => {
    const amount = convertAmount(baseAmount)
    try {
      return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: currency.value,
      }).format(amount)
    } catch {
      return `${currency.value} ${amount.toFixed(2)}`
    }
  }

  return {
    baseCurrency,
    currency,
    exchangeRate,
    convertAmount,
    formatAmount,
  }
}
