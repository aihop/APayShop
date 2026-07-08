<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ $t('admin.nav.scheduler') }}</h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          到点对站内路径发起请求的定时 Webhook。目标端点自带鉴权（如 ?token=）且必须幂等；
          周期支持 hourly / daily / weekly 或数字分钟数。
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UButton color="neutral" variant="outline" icon="ph:arrows-clockwise" :loading="pending" @click="() => refresh()">刷新</UButton>
        <UButton color="primary" icon="ph:floppy-disk" :loading="saving" @click="saveAll">保存配置</UButton>
      </div>
    </div>

    <UCard class="border border-gray-200 bg-white dark:border-gray-800/50 dark:bg-[#121214]">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-800">
              <th class="py-2 pr-3 w-40">名称</th>
              <th class="py-2 pr-3">路径（站内，可含 ?token=）</th>
              <th class="py-2 pr-3 w-32">周期</th>
              <th class="py-2 pr-3 w-16">启用</th>
              <th class="py-2 pr-3 w-44">最近运行</th>
              <th class="py-2 pr-3">最近结果</th>
              <th class="py-2 w-32" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(job, index) in jobs" :key="index" class="border-b border-gray-100 align-middle dark:border-gray-800/50">
              <td class="py-2 pr-3"><UInput v-model="job.name" size="sm" placeholder="qingpu-maintenance" /></td>
              <td class="py-2 pr-3"><UInput v-model="job.path" size="sm" placeholder="/api/qingpu/admin/maintenance?token=..." class="font-mono" /></td>
              <td class="py-2 pr-3">
                <select v-model="job.schedule" class="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  <option value="hourly">每小时</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option :value="30">每 30 分钟</option>
                  <option :value="10">每 10 分钟</option>
                </select>
              </td>
              <td class="py-2 pr-3"><USwitch v-model="job.enabled" /></td>
              <td class="py-2 pr-3 text-xs text-gray-500">{{ formatDate(job.lastRun) }}</td>
              <td class="py-2 pr-3 max-w-[220px]">
                <span class="block truncate text-xs" :class="resultClass(job.lastResult)" :title="job.lastResult || ''">{{ job.lastResult || '-' }}</span>
              </td>
              <td class="py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <UButton color="neutral" variant="outline" size="xs" :loading="triggering === job.name" @click="triggerJob(job)">立即执行</UButton>
                  <UButton color="error" variant="ghost" size="xs" icon="ph:trash" @click="jobs.splice(index, 1)" />
                </div>
              </td>
            </tr>
            <tr v-if="jobs.length === 0">
              <td colspan="7" class="py-8 text-center text-gray-400">还没有定时任务，点下方添加</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4">
        <UButton color="neutral" variant="outline" icon="ph:plus" size="sm" @click="addJob">添加任务</UButton>
      </div>
    </UCard>

    <UCard class="border border-gray-200 bg-white dark:border-gray-800/50 dark:bg-[#121214]">
      <div class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        <p>· 调度器随 node 服务常驻运行，每分钟检查一次；serverless 部署下不启动，请改用外部 cron 直调目标路径。</p>
        <p>· 多实例部署下有极小概率同一周期触发两次，目标任务必须自身幂等。</p>
        <p>· 执行历史见 <NuxtLink to="/admin/logs" class="underline">系统日志</NuxtLink>（来源 core.scheduler）。</p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: 'Scheduler' })

interface JobRow {
  name: string
  path: string
  method?: string
  schedule: string | number
  enabled: boolean
  lastRun?: number | null
  lastResult?: string | null
}

const toast = useToast()
const { data, pending, refresh } = await useFetch<{ data: JobRow[] }>('/api/admin/scheduler')

const jobs = ref<JobRow[]>([])
watch(data, (value) => {
  jobs.value = (value?.data || []).map((job) => ({ ...job, enabled: job.enabled !== false }))
}, { immediate: true })

const saving = ref(false)
const triggering = ref('')

function addJob() {
  jobs.value.push({ name: '', path: '', schedule: 'daily', enabled: true })
}

async function saveAll() {
  saving.value = true
  try {
    const res: any = await $fetch('/api/admin/scheduler', {
      method: 'POST',
      body: {
        action: 'save',
        jobs: jobs.value.map(({ lastRun, lastResult, ...job }) => job),
      },
    })
    if (res?.code !== 0) throw new Error(res?.message || '保存失败')
    toast.add({ title: '已保存', color: 'success' })
    await refresh()
  } catch (err: any) {
    toast.add({ title: '保存失败', description: err?.data?.message || err?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function triggerJob(job: JobRow) {
  if (!job.name) return
  triggering.value = job.name
  try {
    const res: any = await $fetch('/api/admin/scheduler', {
      method: 'POST',
      body: { action: 'trigger', name: job.name },
    })
    const ok = res?.data?.ok
    toast.add({
      title: ok ? '执行成功' : '执行失败',
      description: res?.data?.detail || '',
      color: ok ? 'success' : 'error',
    })
    await refresh()
  } catch (err: any) {
    toast.add({ title: '执行失败', description: err?.data?.message || err?.message, color: 'error' })
  } finally {
    triggering.value = ''
  }
}

function resultClass(result?: string | null): string {
  if (!result) return 'text-gray-400'
  return result.startsWith('ok') ? 'text-emerald-500' : 'text-red-500'
}

function formatDate(value?: number | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>
