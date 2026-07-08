import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { logs, settings } from '../db/schema'

/**
 * 核心定时 Webhook 调度器（平台能力，所有主题共用）。
 *
 * 配置：settings 表 key = scheduled_webhooks，value 为 JSON 数组：
 *   [{ "name": "qingpu-maintenance",
 *      "path": "/api/qingpu/admin/maintenance?token=xxx",
 *      "method": "POST",                  // 可省略，默认 POST
 *      "schedule": "daily",               // hourly | daily | weekly | 数字（分钟）
 *      "enabled": true }]                 // 可省略，默认 true
 *
 * 设计约束：
 * - 核心不认识任何主题：只按配置到点对自己内部路径发一次请求，鉴权语义
 *   （如 token 参数）由目标端点自带，调度器不引入新的信任假设；
 * - 目标任务必须幂等：多实例部署下抢占用 settings 状态行做两阶段校验
 *  （写入自己的 runId 后回读确认），极小概率双触发由任务自身幂等兜底；
 * - 仅长驻 node 进程启用：serverless（Cloudflare 等）预设下定时器不可靠，
 *   直接不启动——那类部署用外部 cron 调目标端点即可。
 *
 * 运行状态写在 settings 的 scheduler_state.<name> 行（lastRun/lastResult），
 * /api/admin/scheduler 可查；每次执行结果同时写 logs（source=core.scheduler）。
 */

interface ScheduledWebhook {
  name: string
  path: string
  method?: string
  schedule: 'hourly' | 'daily' | 'weekly' | number
  enabled?: boolean
}

interface JobState {
  lastRun: number
  runId: string
  lastResult?: string
}

const CONFIG_KEY = 'scheduled_webhooks'
const STATE_PREFIX = 'scheduler_state.'
const TICK_MS = 60_000
const FIRST_TICK_DELAY_MS = 30_000
const JOB_TIMEOUT_MS = 120_000

const inflight = new Set<string>()

function scheduleToMs(schedule: ScheduledWebhook['schedule']): number {
  if (typeof schedule === 'number' && Number.isFinite(schedule) && schedule >= 1) {
    return Math.round(schedule) * 60_000
  }
  if (schedule === 'hourly') return 60 * 60_000
  if (schedule === 'weekly') return 7 * 24 * 60 * 60_000
  return 24 * 60 * 60_000 // daily 兜底
}

async function readSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return rows[0]?.value ?? null
}

async function writeSetting(key: string, value: string, description: string): Promise<void> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  if (rows.length > 0) {
    await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value, description })
  }
}

function parseJobs(raw: string | null): ScheduledWebhook[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((job: any) => job
      && typeof job.name === 'string' && job.name
      && typeof job.path === 'string' && job.path.startsWith('/'))
  } catch {
    return []
  }
}

function parseState(raw: string | null): JobState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed?.lastRun === 'number' ? parsed : null
  } catch {
    return null
  }
}

/**
 * 两阶段抢占：写入带自己 runId 的状态 → 回读确认是不是赢家。
 * 跨方言（pg/sqlite/mysql）不依赖 returning/affectedRows，代价是极小的
 * 双触发窗口——调度目标按约定必须幂等。
 */
async function claimRun(job: ScheduledWebhook): Promise<boolean> {
  const stateKey = `${STATE_PREFIX}${job.name}`
  const state = parseState(await readSetting(stateKey))
  const intervalMs = scheduleToMs(job.schedule)
  if (state && Date.now() - state.lastRun < intervalMs) return false

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await writeSetting(
    stateKey,
    JSON.stringify({ lastRun: Date.now(), runId } satisfies JobState),
    `调度器运行状态（自动维护）：${job.name}`,
  )
  await new Promise((resolve) => setTimeout(resolve, 300))
  const confirmed = parseState(await readSetting(stateKey))
  return confirmed?.runId === runId
}

async function recordResult(job: ScheduledWebhook, ok: boolean, detail: string, durationMs: number): Promise<void> {
  const stateKey = `${STATE_PREFIX}${job.name}`
  const state = parseState(await readSetting(stateKey))
  if (state) {
    state.lastResult = `${ok ? 'ok' : 'fail'} ${durationMs}ms ${detail}`.slice(0, 300)
    await writeSetting(stateKey, JSON.stringify(state), `调度器运行状态（自动维护）：${job.name}`)
  }
  await db.insert(logs).values({
    level: ok ? 'info' : 'error',
    message: `scheduled webhook ${job.name}: ${ok ? 'ok' : 'failed'} (${durationMs}ms)`,
    source: 'core.scheduler',
    details: JSON.stringify({ path: job.path.split('?')[0], detail: detail.slice(0, 500) }),
    createdAt: new Date(),
  }).catch(() => {})
}

async function runJob(job: ScheduledWebhook): Promise<void> {
  const startedAt = Date.now()
  try {
    const response = await $fetch.raw(job.path, {
      method: (job.method || 'POST') as any,
      timeout: JOB_TIMEOUT_MS,
      retry: 0,
    })
    await recordResult(job, true, `status=${response.status}`, Date.now() - startedAt)
  } catch (error: any) {
    const detail = error?.data?.message || error?.message || String(error)
    await recordResult(job, false, detail, Date.now() - startedAt)
  }
}

async function tick(): Promise<void> {
  let jobs: ScheduledWebhook[]
  try {
    jobs = parseJobs(await readSetting(CONFIG_KEY))
  } catch (error) {
    console.warn('[scheduler] config read failed:', error)
    return
  }

  for (const job of jobs) {
    if (job.enabled === false) continue
    if (inflight.has(job.name)) continue
    inflight.add(job.name)
    void (async () => {
      try {
        if (await claimRun(job)) {
          await runJob(job)
        }
      } catch (error) {
        console.warn(`[scheduler] job ${job.name} failed:`, error)
      } finally {
        inflight.delete(job.name)
      }
    })()
  }
}

export default defineNitroPlugin(() => {
  // serverless 预设下长驻定时器不可靠，不启动（外部 cron 直调目标端点替代）
  if (process.env.CF_PAGES || (process.env.NITRO_PRESET || '').includes('cloudflare')) {
    return
  }

  setTimeout(() => {
    void tick()
    setInterval(() => void tick(), TICK_MS)
  }, FIRST_TICK_DELAY_MS)

  console.log('[scheduler] scheduled webhook runner started (tick 60s)')
})
