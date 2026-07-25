type StatsRangeQuery = Record<string, any>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * 将 Date 按目标时区拆成 parts。
 * hourCycle 用 h23：hour12:false 在部分 V8 版本下会把午夜格式化成 "24" 而不是 "00"。
 */
function formatPartsInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
}

const partsToNumbers = (d: Date, tz: string) => {
  const parts = formatPartsInTz(d, tz)
  const pick = (type: string) => Number.parseInt(parts.find(p => p.type === type)!.value, 10)
  return {
    year: pick('year'), month: pick('month'), day: pick('day'),
    hour: pick('hour'), minute: pick('minute'), second: pick('second'),
  }
}

/** 该时刻下,目标时区相对 UTC 的偏移(毫秒)。会随夏令时变化,所以必须按具体时刻算。 */
const tzOffsetMs = (d: Date, tz: string) => {
  const p = partsToNumbers(d, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000
}

/**
 * 目标时区里「那一天 00:00」所对应的真实 UTC 时刻。
 *
 * 这里曾经写成 `new Date(Date.UTC(year, month, day))` —— 取的是时区里的日历日期,
 * 却当成 UTC 零点用,等于把一天的起点整体推后了一个时区偏移量(东八区就是 8 小时,
 * 每天 00:00–08:00 的数据都被算进前一天)。
 *
 * 先按「本地墙上时间当作 UTC」猜一次,再减去该时刻的真实偏移;第二遍用第一遍的结果
 * 重新取偏移,以覆盖夏令时切换当天偏移量发生变化的情况。
 */
export const zonedDayStartUtc = (d: Date, tz: string): Date => {
  const p = partsToNumbers(d, tz)
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0)
  let result = wallClockAsUtc - tzOffsetMs(new Date(wallClockAsUtc), tz)
  result = wallClockAsUtc - tzOffsetMs(new Date(result), tz)
  return new Date(result)
}

/**
 * 在目标时区的日历上前后移动整天,并重新对齐到当天起点。
 * 不用固定的 ±86400000: 夏令时切换那天只有 23 或 25 小时,直接加减毫秒会漂移。
 * 先跳到目标日的中午附近再对齐,避免正好落在切换的那一两个小时里。
 */
export const shiftZonedDay = (dayStartUtc: Date, deltaDays: number, tz: string): Date =>
  zonedDayStartUtc(new Date(dayStartUtc.getTime() + deltaDays * 86400000 + 12 * 3600000), tz)

/** 目标时区下的 'YYYY-MM-DD',用于按天分桶。 */
export const toZonedDateKey = (value: Date | string | number, tz: string): string => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const p = partsToNumbers(d, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * 解析 stats 时间范围。
 * @param query - 请求 query 参数
 * @param tz - IANA 时区标识符（默认 'Asia/Shanghai'），用于确定"今天"的边界
 */
export const parseStatsRange = (query: StatsRangeQuery, tz = 'Asia/Shanghai') => {
  const preset = String(query.preset || '').trim()
  const days = clamp(Number.parseInt(String(query.days || '7'), 10) || 7, 1, 90)

  // 目标时区里「今天 00:00」对应的真实 UTC 时刻
  const now = new Date()
  const todayStartUtc = zonedDayStartUtc(now, tz)

  let rangeStart = new Date(todayStartUtc)
  let rangeEnd = new Date(todayStartUtc)

  if (preset === 'today') {
    rangeEnd = new Date()
  } else if (preset === 'yesterday') {
    // yesterday = 前一天 00:00 ~ 今天 00:00
    rangeStart = shiftZonedDay(todayStartUtc, -1, tz)
  } else {
    rangeStart = shiftZonedDay(todayStartUtc, -(days - 1), tz)
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
