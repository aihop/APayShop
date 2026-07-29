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

  return { formatCurrencyAmount }
}
