import {
  claimSchedulerRun,
  loadSchedulerJobs,
  runSchedulerJob,
} from '../utils/scheduler'

/**
 * 核心定时 Webhook 调度器（平台能力，所有主题共用）。
 *
 * 配置在 /admin/scheduler 管理页维护（落 settings 表 scheduled_webhooks）：
 *   [{ "name": "process-subscriptions",
 *      "path": "/api/cron/process-subscriptions",
 *      "method": "GET",                   // 可省略，默认 POST
 *      "schedule": "daily",               // hourly | daily | weekly | 数字（分钟）
 *      "useCronSecret": true,               // 运行时注入 CRON_SECRET Bearer 头
 *      "enabled": true }]
 *
 * 设计约束：
 * - 核心不认识任何主题：只按配置到点对自己内部路径发一次请求；需要通用 cron
 *   鉴权时可从运行环境注入 CRON_SECRET，不把密钥落库或拼入 URL；
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

export default defineNitroPlugin((nitroApp) => {
  if (process.env.CF_PAGES || (process.env.NITRO_PRESET || '').includes('cloudflare')) {
    return
  }

  let intervalHandle: ReturnType<typeof setInterval> | null = null
  const firstTickHandle = setTimeout(() => {
    void tick()
    intervalHandle = setInterval(() => void tick(), TICK_MS)
  }, FIRST_TICK_DELAY_MS)

  // `nuxt build` boots a throw-away Nitro instance internally (to resolve route
  // rules / prerendering) and fires this same "close" hook on it right after -
  // without clearing our timers here, that build-time instance's Node process
  // never drains its event loop and `npm run build` hangs forever post "Build complete".
  nitroApp.hooks.hook('close', () => {
    clearTimeout(firstTickHandle)
    if (intervalHandle) clearInterval(intervalHandle)
  })

  console.log('[scheduler] scheduled webhook runner started (tick 60s)')
})
