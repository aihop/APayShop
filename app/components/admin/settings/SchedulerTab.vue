<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">定时任务</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          到点对站内路径发起请求的定时 Webhook，独立于上方「事件规则」——事件规则是"事情发生时"触发，这里是"到时间了"触发。目标端点自带鉴权且必须幂等。
        </p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
        icon="ph:plus-bold"
        @click="openCreate"
      >新建任务</UButton>
    </div>

    <div class="border border-gray-200 dark:border-gray-800/50 rounded-2xl overflow-hidden">
      <div v-if="pending" class="p-10 text-center text-gray-400">
        <UIcon name="ph:spinner-gap-bold" class="w-6 h-6 animate-spin inline-block" />
      </div>
      <div v-else-if="!jobs.length" class="p-12 text-center">
        <UIcon name="ph:clock-countdown-duotone" class="w-10 h-10 text-purple-400 mx-auto mb-3" />
        <p class="text-gray-600 dark:text-gray-300">还没有定时任务</p>
        <p class="text-xs text-gray-400 mt-1">点击「新建任务」，例如每天检查订阅到期并发提醒邮件。</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800/70">
            <th class="text-left font-medium py-3 px-5">名称</th>
            <th class="text-left font-medium py-3 px-5">路径</th>
            <th class="text-left font-medium py-3 px-5">周期</th>
            <th class="text-left font-medium py-3 px-5">最近运行</th>
            <th class="text-left font-medium py-3 px-5">状态</th>
            <th class="text-right font-medium py-3 px-5">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="job in jobs"
            :key="job.name"
            class="border-b border-gray-100 dark:border-gray-800/50"
          >
            <td class="py-3 px-5 text-gray-900 dark:text-white">{{ job.name }}</td>
            <td class="py-3 px-5 max-w-[280px]">
              <span class="block truncate font-mono text-xs text-gray-500 dark:text-gray-400" :title="job.path">{{ job.path }}</span>
            </td>
            <td class="py-3 px-5 text-gray-700 dark:text-gray-200">{{ scheduleLabel(job.schedule) }}</td>
            <td class="py-3 px-5 text-xs">
              <div class="text-gray-500 dark:text-gray-400">{{ formatDate(job.lastRun) }}</div>
              <div v-if="job.lastResult" class="truncate max-w-[200px]" :class="resultClass(job.lastResult)" :title="job.lastResult">{{ job.lastResult }}</div>
            </td>
            <td class="py-3 px-5">
              <USwitch :model-value="job.enabled !== false" @update:model-value="(v) => toggleEnabled(job, v)" />
            </td>
            <td class="py-3 px-5 text-right whitespace-nowrap">
              <UButton color="neutral" variant="ghost" size="sm" :loading="triggering === job.name" @click="triggerJob(job)">立即执行</UButton>
              <UButton color="neutral" variant="ghost" icon="ph:pencil-simple" size="sm" @click="openEdit(job)" />
              <UButton color="error" variant="ghost" icon="ph:trash" size="sm" @click="removeJob(job)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-gray-400">
      调度器随 node 服务常驻每分钟检查一次；serverless 部署下不生效，需改用外部 cron 直调目标路径。
      多实例部署下有极小概率同一周期触发两次，目标任务必须自身幂等。执行历史见
      <NuxtLink to="/admin/logs" class="underline">系统日志</NuxtLink>（来源 core.scheduler）。
    </p>

    <!-- Create / Edit modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ form.originalName ? '编辑任务' : '新建任务' }}</h3>

          <div>
            <label class="block text-xs text-gray-500 mb-1">名称</label>
            <UInput v-model="form.name" placeholder="qingpu-maintenance" class="w-full" />
          </div>

          <div>
            <label class="block text-xs text-gray-500 mb-1">路径（站内，可含 ?token=）</label>
            <UInput v-model="form.path" placeholder="/api/qingpu/admin/maintenance?token=..." class="w-full font-mono" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">请求方法</label>
              <USelect v-model="form.method" :items="methodOptions" class="w-full" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">周期</label>
              <USelect v-model="form.schedule" :items="scheduleOptions" class="w-full" />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <USwitch v-model="form.enabled" />
            <span class="text-sm text-gray-600 dark:text-gray-300">启用</span>
          </div>

          <div v-if="formError" class="text-xs text-red-400">{{ formError }}</div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="modalOpen = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="save">保存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useFetch } from '#imports'

interface JobRow {
  name: string
  path: string
  method?: string
  schedule: string | number
  enabled?: boolean
  lastRun?: number | null
  lastResult?: string | null
}

const methodOptions = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
]
const scheduleOptions = [
  { label: '每小时', value: 'hourly' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每 30 分钟', value: 30 },
  { label: '每 10 分钟', value: 10 },
]
const scheduleLabel = (v: string | number) => scheduleOptions.find(o => o.value === v)?.label || String(v)

const { data, pending, refresh } = useFetch<{ data: JobRow[] }>('/api/admin/scheduler')
const jobs = computed(() => data.value?.data || [])

const modalOpen = ref(false)
const saving = ref(false)
const triggering = ref('')
const formError = ref('')
const form = reactive<any>({
  originalName: null,
  name: '',
  path: '',
  method: 'POST',
  schedule: 'daily',
  enabled: true,
})

const openCreate = () => {
  Object.assign(form, { originalName: null, name: '', path: '', method: 'POST', schedule: 'daily', enabled: true })
  formError.value = ''
  modalOpen.value = true
}

const openEdit = (job: JobRow) => {
  Object.assign(form, {
    originalName: job.name,
    name: job.name,
    path: job.path,
    method: job.method || 'POST',
    schedule: job.schedule,
    enabled: job.enabled !== false,
  })
  formError.value = ''
  modalOpen.value = true
}

/** 后端是整份数组保存（非逐条 REST），本地基于当前列表算出下一份再整体提交 */
async function persist(nextJobs: JobRow[]): Promise<boolean> {
  try {
    const res: any = await $fetch('/api/admin/scheduler', {
      method: 'POST',
      body: {
        action: 'save',
        jobs: nextJobs.map(({ lastRun, lastResult, ...job }) => job),
      },
    })
    if (res?.code !== 0) throw new Error(res?.message || '保存失败')
    await refresh()
    return true
  } catch (e: any) {
    formError.value = e?.data?.message || e?.message || '保存失败'
    return false
  }
}

const save = async () => {
  if (!form.name.trim()) {
    formError.value = '名称不能为空'
    return
  }
  if (!form.path.trim().startsWith('/')) {
    formError.value = '路径必须以 / 开头'
    return
  }
  const duplicate = jobs.value.some(j => j.name === form.name && j.name !== form.originalName)
  if (duplicate) {
    formError.value = '任务名称已存在'
    return
  }

  const nextJob: JobRow = {
    name: form.name.trim(),
    path: form.path.trim(),
    method: form.method,
    schedule: form.schedule,
    enabled: form.enabled,
  }

  const next = form.originalName
    ? jobs.value.map(j => (j.name === form.originalName ? nextJob : j))
    : [...jobs.value, nextJob]

  saving.value = true
  try {
    if (await persist(next)) {
      modalOpen.value = false
    }
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (job: JobRow, value: boolean) => {
  const next = jobs.value.map(j => (j.name === job.name ? { ...j, enabled: value } : j))
  await persist(next)
}

const removeJob = async (job: JobRow) => {
  if (!confirm(`确定删除任务「${job.name}」吗？`)) return
  const next = jobs.value.filter(j => j.name !== job.name)
  await persist(next)
}

const triggerJob = async (job: JobRow) => {
  triggering.value = job.name
  try {
    const res: any = await $fetch('/api/admin/scheduler', {
      method: 'POST',
      body: { action: 'trigger', name: job.name },
    })
    await refresh()
    if (!res?.data?.ok) {
      alert(`执行失败：${res?.data?.detail || '未知错误'}`)
    }
  } catch (e: any) {
    alert(`执行失败：${e?.data?.message || e?.message || '未知错误'}`)
  } finally {
    triggering.value = ''
  }
}

const resultClass = (result?: string | null) => {
  if (!result) return 'text-gray-400'
  return result.startsWith('ok') ? 'text-emerald-500' : 'text-red-500'
}

const formatDate = (value?: number | null) => {
  if (!value) return '未运行过'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>
