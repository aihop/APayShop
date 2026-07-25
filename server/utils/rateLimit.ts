interface RateLimitEntry {
  count: number
  resetAt: number
}

const _buckets = new Map<string, RateLimitEntry>()

function cleanup() {
  const now = Date.now()
  for (const [key, val] of _buckets) {
    if (val.resetAt <= now) _buckets.delete(key)
  }
}

setInterval(cleanup, 60_000).unref?.()

export function checkIpRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const existing = _buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    _buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.max - 1, retryAfterMs: 0 }
  }
  if (existing.count >= opts.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    }
  }
  existing.count += 1
  return { ok: true, remaining: opts.max - existing.count, retryAfterMs: 0 }
}

export function resolveClientIp(event: any): string {
  const headers = event?.node?.req?.headers || event?.headers || {}
  const forwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  if (typeof forwardedFor === 'string') {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers['x-real-ip'] || headers['X-Real-IP']
  if (typeof realIp === 'string' && realIp) return realIp
  const socket = event?.node?.req?.socket || event?.context?.sockets?.[0]
  const addr = socket?.remoteAddress
  return addr || 'unknown'
}
