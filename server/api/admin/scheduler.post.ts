import {
  loadSchedulerJobs,
  runSchedulerJob,
  saveSchedulerJobs,
  type ScheduledWebhook,
} from '../../utils/scheduler'

/**
 * 定时任务管理写入口：
 *  - { action: 'save', jobs: [...] }   保存整份任务配置（校验后落 settings）
 *  - { action: 'trigger', name }       忽略周期立即执行一次（手动补跑/验证配置）
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))

  if (body?.action === 'save') {
    const rawJobs = Array.isArray(body.jobs) ? body.jobs : null
    if (!rawJobs) {
      throw createError({ statusCode: 400, message: 'jobs must be an array' })
    }
    const seen = new Set<string>()
    const jobs: ScheduledWebhook[] = []
    for (const raw of rawJobs) {
      const name = String(raw?.name || '').trim()
      const path = String(raw?.path || '').trim()
      const schedule = raw?.schedule
      if (!name) throw createError({ statusCode: 400, message: '任务名称不能为空' })
      if (seen.has(name)) throw createError({ statusCode: 400, message: `任务名称重复：${name}` })
      if (!path.startsWith('/')) throw createError({ statusCode: 400, message: `路径必须以 / 开头：${name}` })
      const validSchedule = schedule === 'hourly' || schedule === 'daily' || schedule === 'weekly'
        || (typeof schedule === 'number' && Number.isFinite(schedule) && schedule >= 1)
      if (!validSchedule) throw createError({ statusCode: 400, message: `周期不合法：${name}` })
      seen.add(name)
      jobs.push({
        name,
        path,
        schedule,
        ...(raw?.method ? { method: String(raw.method).toUpperCase() } : {}),
        enabled: raw?.enabled !== false,
      })
    }
    await saveSchedulerJobs(jobs)
    return { code: 0, message: 'saved', count: jobs.length }
  }

  if (body?.action === 'trigger') {
    const name = String(body?.name || '').trim()
    const jobs = await loadSchedulerJobs()
    const job = jobs.find((item) => item.name === name)
    if (!job) throw createError({ statusCode: 404, message: `任务不存在：${name}` })
    const result = await runSchedulerJob(job)
    return { code: 0, data: result }
  }

  throw createError({ statusCode: 400, message: 'Unknown action' })
})
