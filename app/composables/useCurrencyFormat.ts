const normalizeCurrencyCode = (value: unknown) => {
  const currency = String(value || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

export const useCurrencyFormat = () => {
  const { locale } = useI18n()

  const formatCurrencyAmount = (amountValue: unknown, currencyValue: unknown) => {
    const amount = Number(amountValue || 0)
    const currency = normalizeCurrencyCode(currencyValue)

    try {
      return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency,
      }).format(Number.isFinite(amount) ? amount : 0)
    } catch {
      return `${currency} ${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
    }
  }

  const formatCurrencyTotals = (values: unknown, emptyCurrency?: unknown) => {
    if (!Array.isArray(values) || values.length === 0) {
      return emptyCurrency ? formatCurrencyAmount(0, emptyCurrency) : '—'
    }
    return values
      .filter(item => item && typeof item === 'object')
      .map(item => formatCurrencyAmount((item as any).amount, (item as any).currency))
      .join(' + ')
  }

  return { formatCurrencyAmount, formatCurrencyTotals }
}
