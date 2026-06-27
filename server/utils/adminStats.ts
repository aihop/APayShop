type StatsRangeQuery = Record<string, any>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 将 Date 按目标时区拆成 parts。
 */
function formatPartsInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
}

/**
 * 解析 stats 时间范围。
 * @param query - 请求 query 参数
 * @param tz - IANA 时区标识符（默认 'Asia/Shanghai'），用于确定"今天"的边界
 */
export const parseStatsRange = (query: StatsRangeQuery, tz = 'Asia/Shanghai') => {
  const preset = String(query.preset || '').trim()
  const days = clamp(Number.parseInt(String(query.days || '7'), 10) || 7, 1, 90)

  // 按目标时区计算今天 00:00 UTC 时间
  const now = new Date()
  const parts = formatPartsInTz(now, tz)
  const year = parseInt(parts.find(p => p.type === 'year')!.value)
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1
  const day = parseInt(parts.find(p => p.type === 'day')!.value)
  const todayStartUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))

  let rangeStart = new Date(todayStartUtc)
  let rangeEnd = new Date(todayStartUtc)

  if (preset === 'today') {
    rangeEnd = new Date()
  } else if (preset === 'yesterday') {
    // yesterday = 前一天 00:00 ~ 今天 00:00
    rangeStart = new Date(todayStartUtc.getTime() - 86400000)
  } else {
    rangeStart = new Date(todayStartUtc.getTime() - (days - 1) * 86400000)
    rangeEnd = new Date()
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
