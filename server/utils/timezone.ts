import { settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'

const DEFAULT_TZ = 'Asia/Shanghai'

/**
 * 读取 settings 表中配置的时区，默认 Asia/Shanghai。
 */
export async function getConfiguredTimezone(): Promise<string> {
  try {
    const rows = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'timezone'))
    return rows[0]?.value || DEFAULT_TZ
  } catch {
    return DEFAULT_TZ
  }
}

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
 * 返回目标时区「今天 00:00:00」对应的 UTC 毫秒、秒、ISO 字符串。
 */
export function getStartOfDayUtc(tz: string): { ms: number; sec: number; iso: string; mysql: string } {
  const now = new Date()
  const parts = formatPartsInTz(now, tz)
  const year = parseInt(parts.find(p => p.type === 'year')!.value)
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1
  const day = parseInt(parts.find(p => p.type === 'day')!.value)

  const ms = Date.UTC(year, month, day, 0, 0, 0, 0)
  const iso = new Date(ms).toISOString()
  return {
    ms,
    sec: Math.floor(ms / 1000),
    iso,
    mysql: iso.replace('T', ' ').substring(0, 19),
  }
}

/**
 * 返回目标时区相对 UTC 的偏移分钟数（正值 = 快于 UTC，如 Asia/Shanghai = +480）。
 * 该偏移基于「今天午夜」计算，DST 过渡日会有 ±1 小时误差，可接受。
 */
export function getTimezoneOffsetMinutes(tz: string): number {
  const { ms } = getStartOfDayUtc(tz)
  const parts = formatPartsInTz(new Date(ms), tz)
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value)
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value)

  let offset = hour * 60 + minute
  if (offset > 12 * 60) {
    offset -= 24 * 60
  }
  return offset
}

/**
 * 格式化为 SQLite datetime modifier，如 '+480 minutes' 或 '-300 minutes'。
 */
export function getSqliteOffsetModifier(tz: string): string {
  const m = getTimezoneOffsetMinutes(tz)
  const sign = m >= 0 ? '+' : '-'
  return `${sign}${Math.abs(m)} minutes`
}

/**
 * 格式化为 MySQL CONVERT_TZ 偏移字符串，如 '+08:00' 或 '-05:00'。
 */
export function getMysqlOffsetStr(tz: string): string {
  const m = getTimezoneOffsetMinutes(tz)
  const sign = m >= 0 ? '+' : '-'
  const abs = Math.abs(m)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

/**
 * 返回目标时区当前小时数 (0-23)。
 */
export function getCurrentHour(tz: string): number {
  const parts = formatPartsInTz(new Date(), tz)
  return parseInt(parts.find(p => p.type === 'hour')!.value)
}
