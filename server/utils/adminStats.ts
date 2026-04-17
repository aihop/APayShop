type StatsRangeQuery = Record<string, any>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const parseStatsRange = (query: StatsRangeQuery) => {
  const preset = String(query.preset || '').trim()
  const days = clamp(Number.parseInt(String(query.days || '7'), 10) || 7, 1, 90)
  const rangeStart = new Date()
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date()

  if (preset === 'today') {
    rangeEnd.setTime(Date.now())
  } else if (preset === 'yesterday') {
    rangeEnd.setTime(rangeStart.getTime())
    rangeStart.setDate(rangeStart.getDate() - 1)
  } else {
    rangeStart.setDate(rangeStart.getDate() - days + 1)
    rangeEnd.setTime(Date.now())
  }

  return {
    preset: preset || `${days}d`,
    days,
    rangeStart,
    rangeEnd,
  }
}

export const clampStatsPage = (value: unknown, fallback = 1) => {
  return clamp(Number.parseInt(String(value || fallback), 10) || fallback, 1, 999999)
}

export const clampStatsPageSize = (value: unknown, fallback = 20) => {
  return clamp(Number.parseInt(String(value || fallback), 10) || fallback, 1, 100)
}
