import Redis from 'ioredis'

const normalizeEnv = (val?: string) => (val || '').replace(/"/g, '').trim()

const resolveRedisUrl = () => normalizeEnv(
  process.env.GORAY_REDIS_URL
  || process.env.REDIS_URL
)

let redisClient: Redis | null = null

export const getRedisClient = (): Redis | null => {
  if (redisClient) return redisClient
  const url = resolveRedisUrl()
  if (!url) return null

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
    })
    return redisClient
  } catch (err) {
    console.warn('[goray-redis] Failed to initialize Redis client, falling back to memory store:', err)
    return null
  }
}

// 内存后备存储（当未配置 Redis 或单机开发时使用）
const memoryStore = new Map<string, { value: string; expiresAt: number }>()

const cleanMemoryStore = () => {
  const now = Date.now()
  for (const [k, v] of memoryStore.entries()) {
    if (v.expiresAt <= now) {
      memoryStore.delete(k)
    }
  }
}

export const setWithTtl = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  const redis = getRedisClient()
  if (redis) {
    await redis.set(key, value, 'EX', ttlSeconds)
    return
  }
  cleanMemoryStore()
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export const getByKey = async (key: string): Promise<string | null> => {
  const redis = getRedisClient()
  if (redis) {
    return await redis.get(key)
  }
  cleanMemoryStore()
  const entry = memoryStore.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(key)
    return null
  }
  return entry.value
}

export const deleteByKey = async (key: string): Promise<void> => {
  const redis = getRedisClient()
  if (redis) {
    await redis.del(key)
    return
  }
  memoryStore.delete(key)
}

/**
 * 防重放检查：如果键已存在返回 false（已重放），不存在则写入并返回 true
 */
export const checkReplay = async (replayKey: string, ttlSeconds = 600): Promise<boolean> => {
  const redis = getRedisClient()
  if (redis) {
    const res = await redis.set(`goray:replay:${replayKey}`, '1', 'EX', ttlSeconds, 'NX')
    return res === 'OK'
  }
  cleanMemoryStore()
  const fullKey = `goray:replay:${replayKey}`
  if (memoryStore.has(fullKey)) {
    return false
  }
  memoryStore.set(fullKey, { value: '1', expiresAt: Date.now() + ttlSeconds * 1000 })
  return true
}

/**
 * 简易限流器：在 windowSeconds 内至多允许 maxRequests 次请求
 */
export const checkRateLimit = async (limitKey: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> => {
  const redis = getRedisClient()
  const key = `goray:ratelimit:${limitKey}`

  if (redis) {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
    }
  }

  cleanMemoryStore()
  const entry = memoryStore.get(key)
  const currentCount = entry ? Number(entry.value) : 0
  const nextCount = currentCount + 1
  const expiresAt = entry ? entry.expiresAt : Date.now() + windowSeconds * 1000

  memoryStore.set(key, { value: String(nextCount), expiresAt })
  return {
    allowed: nextCount <= maxRequests,
    remaining: Math.max(0, maxRequests - nextCount),
  }
}
