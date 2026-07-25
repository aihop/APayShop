/**
 * Normalizes a timestamp column value to an ISO-8601 string across all three
 * supported dialects.
 *
 * The shape that comes back depends on both the dialect AND how the value was
 * selected, which is why this has to be defensive:
 *
 *  - Typed column via drizzle (`select({ createdAt: table.createdAt })`)
 *    → a Date, because drizzle's column mapper converts it.
 *
 *  - Raw fragment (`` sql`MIN(${table.createdAt})` ``)
 *    → NO column mapper runs, so you get the driver's raw value. On Postgres
 *      drizzle installs a "transparent parser" for the timestamp OIDs
 *      (1184/1114/1082/…, see drizzle-orm/postgres-js/driver.js), so the value
 *      arrives as the raw Postgres string `2026-07-08 12:12:29.54+00`.
 *      `Number()` on that is NaN — the trap that made stats/events throw
 *      "RangeError: Invalid time value".
 *
 *  - SQLite → an integer, and `unixepoch()` defaults mean it's in SECONDS,
 *    not milliseconds.
 *
 *  - MySQL (mysql2) → a Date, or a string when `dateStrings` is on.
 *
 * A bare `YYYY-MM-DD HH:MM:SS[.fff]` with no offset is read as UTC, not local
 * time: every writer in this codebase stores `new Date()`, so the wall-clock
 * text coming back is UTC. Letting V8 parse it as local time would silently
 * shift every rendered timestamp by the server's offset.
 */

// Matches a date-time with no trailing timezone designator.
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/
// Sub-second precision beyond milliseconds is fine for Date, but a trailing
// offset means we must NOT append 'Z'.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2}|[+-]\d{2})$/i

/** Anything below this is treated as seconds rather than milliseconds. */
const SECONDS_THRESHOLD = 1e12

const fromEpoch = (value: number) => {
  const ms = Math.abs(value) < SECONDS_THRESHOLD ? value * 1000 : value
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * @param value  raw column/aggregate value
 * @returns ISO string, or '' when the value is empty. An unparseable string is
 *          returned as-is rather than discarded, so bad data stays visible
 *          instead of silently becoming a wrong date.
 */
export const toIsoTimestamp = (value: unknown): string => {
  if (value === null || value === undefined) return ''

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? '' : fromEpoch(value) ?? ''
  }

  if (typeof value === 'bigint') {
    return fromEpoch(Number(value)) ?? ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    // Epoch as text (SQLite integer columns can surface this way).
    if (/^\d+$/.test(trimmed)) {
      return fromEpoch(Number(trimmed)) ?? trimmed
    }

    const candidate = NAIVE_DATETIME.test(trimmed) && !HAS_TIMEZONE.test(trimmed)
      ? `${trimmed.replace(' ', 'T')}Z`
      : trimmed

    const date = new Date(candidate)
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
  }

  return ''
}

/** Same as toIsoTimestamp, but never returns '' — for non-nullable columns. */
export const toIsoTimestampOrEpoch = (value: unknown): string =>
  toIsoTimestamp(value) || new Date(0).toISOString()
