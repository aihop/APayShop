import {
  claimSchedulerRun,
  loadSchedulerJobs,
  runSchedulerJob,
} from '../utils/scheduler'

/**
 * 核心定时 Webhook 调度器（平台能力，所有主题共用）。
 *
 * 配置在 /admin/scheduler 管理页维护（落 settings 表 scheduled_webhooks）：
 *   [{ "name": "qingpu-maintenance",
 *      "path": "/api/qingpu/admin/maintenance?token=xxx",
 *      "method": "POST",                  // 可省略，默认 POST
 *      "schedule": "daily",               // hourly | daily | weekly | 数字（分钟）
 *      "enabled": true }]
 *
 * 设计约束：
 * - 核心不认识任何主题：只按配置到点对自己内部路径发一次请求，鉴权语义
 *   （如 token 参数）由目标端点自带，调度器不引入新的信任假设；
 * - 目标任务必须幂等：多实例抢占是两阶段校验，存在极小双触发窗口；
 * - 仅长驻 node 进程启用：serverless 预设下定时器不可靠，直接不启动，
 *   那类部署用外部 cron 直调目标端点。
 */

const TICK_MS = 60_000
const FIRST_TICK_DELAY_MS = 30_000

const inflight = new Set<string>()

async function tick(): Promise<void> {
  let jobs
  try {
    jobs = await loadSchedulerJobs()
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
        if (await claimSchedulerRun(job)) {
          await runSchedulerJob(job)
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
  if (process.env.CF_PAGES || (process.env.NITRO_PRESET || '').includes('cloudflare')) {
    return
  }

  setTimeout(() => {
    void tick()
    setInterval(() => void tick(), TICK_MS)
  }, FIRST_TICK_DELAY_MS)

  console.log('[scheduler] scheduled webhook runner started (tick 60s)')
})
