import { eq, like } from 'drizzle-orm'
import { settings } from '../../db/schema'
import { db } from '../../db/runtime'

/**
 * 定时任务状态一览（配置 + 各任务最近运行结果）。
 * 配置本身在 settings 表 key=scheduled_webhooks 里改（后台系统设置）。
 */
export default defineEventHandler(async () => {
  const configRows = await db.select().from(settings).where(eq(settings.key, 'scheduled_webhooks')).limit(1)
  let jobs: any[] = []
  try {
    const parsed = JSON.parse(configRows[0]?.value || '[]')
    if (Array.isArray(parsed)) jobs = parsed
  } catch {
    // 配置 JSON 非法：返回空列表 + 原文供排查
  }

  const stateRows = await db.select().from(settings).where(like(settings.key, 'scheduler_state.%'))
  const stateByName = new Map(stateRows.map((row) => {
    let state: any = null
    try {
      state = JSON.parse(row.value)
    } catch {}
    return [row.key.slice('scheduler_state.'.length), state]
  }))

  return {
    code: 0,
    data: jobs.map((job: any) => ({
      name: job.name,
      path: String(job.path || '').split('?')[0],
      schedule: job.schedule,
      enabled: job.enabled !== false,
      lastRun: stateByName.get(job.name)?.lastRun || null,
      lastResult: stateByName.get(job.name)?.lastResult || null,
    })),
    rawConfig: configRows[0]?.value || '',
  }
})
