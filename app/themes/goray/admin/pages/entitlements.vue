<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">用户权益明细</h1>
      <p class="text-xs text-slate-500 mt-1">查看所有用户的订阅权益、设备上限与流量消耗</p>
    </div>

    <div class="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
          <tr>
            <th class="px-4 py-3">用户</th>
            <th class="px-4 py-3">来源类型</th>
            <th class="px-4 py-3">套餐代码</th>
            <th class="px-4 py-3">设备数</th>
            <th class="px-4 py-3">已用流量 / 限额</th>
            <th class="px-4 py-3">到期时间</th>
            <th class="px-4 py-3">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-if="entitlements.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-slate-400">暂无权益记录</td>
          </tr>
          <tr v-for="e in entitlements" :key="e.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{{ e.user_email }}</td>
            <td class="px-4 py-3 uppercase font-mono text-[11px]">{{ e.source_type }}</td>
            <td class="px-4 py-3 font-bold text-[#0066FF]">{{ e.plan_code }}</td>
            <td class="px-4 py-3">{{ e.device_limit }} 台</td>
            <td class="px-4 py-3 font-mono text-[11px]">
              {{ formatBytes(e.used_traffic_bytes) }} / {{ Number(e.traffic_limit_bytes) === 0 ? '无限' : formatBytes(e.traffic_limit_bytes) }}
            </td>
            <td class="px-4 py-3 text-slate-500">{{ new Date(e.expires_at).toLocaleDateString() }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="e.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'">
                {{ e.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const entitlements = ref<any[]>([])

const loadEntitlements = async () => {
  try {
    const res: any = await $fetch('/api/admin/goray/entitlements')
    entitlements.value = res.data?.entitlements || []
  } catch {}
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadEntitlements()
})
</script>
