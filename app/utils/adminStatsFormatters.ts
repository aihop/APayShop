export const formatStatsNumber = (
  value: number | string | undefined,
  locale: string,
): string => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US')
  .format(Number(value || 0))

export const formatStatsPercent = (value: number | string | undefined): string =>
  `${Number(value || 0).toFixed(1)}%`

export const getStatsTrendWidth = (value: number, max: number): number =>
  max ? Number(((value / max) * 100).toFixed(1)) : 0

export const shortenVisitorId = (value: string): string => {
  if (!value) return '-'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

export const formatRegionCity = (item: { region?: unknown, city?: unknown }): string => {
  const parts = [item.region, item.city].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : '-'
}
