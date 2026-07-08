import { eq, like } from 'drizzle-orm'
import { db } from '../db/runtime'
import { logs, settings } from '../db/schema'

/**
 * 定时 Webhook 调度器的共享内核：配置/状态读写、抢占、执行。
 * 消费方：server/plugins/scheduler.ts（tick 循环）、/api/admin/scheduler*（管理）。
 * 设计约束见 plugins/scheduler.ts 头注释。
 */

export interface ScheduledWebhook {
  name: string
  path: string
  method?: string
  schedule: 'hourly' | 'daily' | 'weekly' | number
  enabled?: boolean
}

export interface SchedulerJobState {
  lastRun: number
  runId: string
  lastResult?: string
}

export const SCHEDULER_CONFIG_KEY = 'scheduled_webhooks'
export const SCHEDULER_STATE_PREFIX = 'scheduler_state.'
const JOB_TIMEOUT_MS = 120_000

export function scheduleToMs(schedule: ScheduledWebhook['schedule']): number {
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

export function parseSchedulerJobs(raw: string | null): ScheduledWebhook[] {
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

function parseState(raw: string | null): SchedulerJobState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed?.lastRun === 'number' ? parsed : null
  } catch {
    return null
  }
}

export async function loadSchedulerJobs(): Promise<ScheduledWebhook[]> {
  return parseSchedulerJobs(await readSetting(SCHEDULER_CONFIG_KEY))
}

export async function saveSchedulerJobs(jobs: ScheduledWebhook[]): Promise<void> {
  await writeSetting(
    SCHEDULER_CONFIG_KEY,
    JSON.stringify(jobs),
    '定时 Webhook 任务配置（/admin/scheduler 管理）',
  )
}

/**
 * 两阶段抢占：写入带自己 runId 的状态 → 回读确认是不是赢家。
 * 跨方言（pg/sqlite/mysql）不依赖 returning/affectedRows，代价是极小的
 * 双触发窗口——调度目标按约定必须幂等。
 */
export async function claimSchedulerRun(job: ScheduledWebhook): Promise<boolean> {
  const stateKey = `${SCHEDULER_STATE_PREFIX}${job.name}`
  const state = parseState(await readSetting(stateKey))
  const intervalMs = scheduleToMs(job.schedule)
  if (state && Date.now() - state.lastRun < intervalMs) return false

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await writeSetting(
    stateKey,
    JSON.stringify({ lastRun: Date.now(), runId } satisfies SchedulerJobState),
    `调度器运行状态（自动维护）：${job.name}`,
  )
  await new Promise((resolve) => setTimeout(resolve, 300))
  const confirmed = parseState(await readSetting(stateKey))
  return confirmed?.runId === runId
}

async function recordResult(job: ScheduledWebhook, ok: boolean, detail: string, durationMs: number): Promise<void> {
  const stateKey = `${SCHEDULER_STATE_PREFIX}${job.name}`
  const state = parseState(await readSetting(stateKey))
    || { lastRun: Date.now(), runId: 'manual' }
  state.lastResult = `${ok ? 'ok' : 'fail'} ${durationMs}ms ${detail}`.slice(0, 300)
  await writeSetting(stateKey, JSON.stringify(state), `调度器运行状态（自动维护）：${job.name}`)

  await db.insert(logs).values({
    level: ok ? 'info' : 'error',
    message: `scheduled webhook ${job.name}: ${ok ? 'ok' : 'failed'} (${durationMs}ms)`,
    source: 'core.scheduler',
    details: JSON.stringify({ path: job.path.split('?')[0], detail: detail.slice(0, 500) }),
    createdAt: new Date(),
  }).catch(() => {})
}

/** 执行一个任务并记录结果（手动触发与 tick 共用）；返回是否成功 */
export async function runSchedulerJob(job: ScheduledWebhook): Promise<{ ok: boolean; detail: string }> {
  const startedAt = Date.now()
  try {
    const response = await $fetch.raw(job.path, {
      method: (job.method || 'POST') as any,
      timeout: JOB_TIMEOUT_MS,
      retry: 0,
    })
    const detail = `status=${response.status}`
    await recordResult(job, true, detail, Date.now() - startedAt)
    return { ok: true, detail }
  } catch (error: any) {
    const detail = error?.data?.message || error?.message || String(error)
    await recordResult(job, false, detail, Date.now() - startedAt)
    return { ok: false, detail }
  }
}

/** 管理端状态一览：配置 + 各任务最近运行 */
export async function listSchedulerStatus(): Promise<Array<Record<string, unknown>>> {
  const jobs = await loadSchedulerJobs()
  const stateRows = await db.select().from(settings).where(like(settings.key, `${SCHEDULER_STATE_PREFIX}%`))
  const stateByName = new Map<string, SchedulerJobState | null>(
    stateRows.map((row: { key: string; value: string }) => [
      row.key.slice(SCHEDULER_STATE_PREFIX.length),
      parseState(row.value),
    ]),
  )
  return jobs.map((job) => ({
    name: job.name,
    path: job.path,
    method: job.method || 'POST',
    schedule: job.schedule,
    enabled: job.enabled !== false,
    lastRun: stateByName.get(job.name)?.lastRun || null,
    lastResult: stateByName.get(job.name)?.lastResult || null,
  }))
}
