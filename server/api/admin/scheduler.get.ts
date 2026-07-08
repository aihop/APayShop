import { listSchedulerStatus } from '../../utils/scheduler'

/** 定时任务状态一览（配置 + 最近运行结果），管理页 /admin/scheduler 的数据源 */
export default defineEventHandler(async () => {
  return { code: 0, data: await listSchedulerStatus() }
})
