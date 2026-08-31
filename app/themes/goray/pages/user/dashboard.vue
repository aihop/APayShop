<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-12">
    <!-- User Greeting -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          控制面板
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          管理您的 Goray 套餐权益与授权设备
        </p>
      </div>

      <div class="flex items-center gap-3">
        <NuxtLink
          to="/activate"
          class="px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-colors inline-flex items-center gap-1.5"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          激活新设备
        </NuxtLink>
        <NuxtLink
          to="/pricing"
          class="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          续费 / 升级
        </NuxtLink>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="grid sm:grid-cols-3 gap-6 mb-12">
      <!-- Status Card -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div class="text-xs text-slate-400 font-medium mb-1">当前套餐状态</div>
        <div class="flex items-center gap-2 mt-2">
          <span class="w-2.5 h-2.5 rounded-full" :class="profile?.is_active ? 'bg-emerald-500' : 'bg-amber-500'"></span>
          <span class="text-lg font-bold text-slate-900 dark:text-white">
            {{ profile?.is_active ? '已开通服务' : '未订阅 / 已到期' }}
          </span>
        </div>
        <div class="text-xs text-slate-400 mt-2">
          到期时间: {{ profile?.expires_at ? new Date(profile.expires_at).toLocaleDateString() : '暂无' }}
        </div>
      </div>

      <!-- Devices Card -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div class="text-xs text-slate-400 font-medium mb-1">在线设备配额</div>
        <div class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
          {{ devices.length }} / {{ profile?.device_limit || 3 }}
        </div>
        <div class="text-xs text-slate-400 mt-2">
          <NuxtLink to="/user/devices" class="text-[#0066FF] hover:underline">管理已授权设备 →</NuxtLink>
        </div>
      </div>

      <!-- Traffic Card -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div class="text-xs text-slate-400 font-medium mb-1">本周期用量</div>
        <div class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
          {{ formatBytes(profile?.used_traffic_bytes || 0) }}
        </div>
        <div class="text-xs text-slate-400 mt-2">
          {{ profile?.traffic_limit_bytes ? `上限: ${formatBytes(profile.traffic_limit_bytes)}` : '高速不限流量' }}
        </div>
      </div>
    </div>

    <!-- Active Devices Table -->
    <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">已连接设备</h2>
        <NuxtLink to="/user/devices" class="text-xs font-semibold text-[#0066FF] hover:underline">
          查看全部
        </NuxtLink>
      </div>

      <div v-if="devices.length === 0" class="text-center py-8 text-xs text-slate-400">
        暂无已绑定的设备，请在客户端打开后点击「激活新设备」。
      </div>

      <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="d in devices"
          :key="d.id"
          class="py-3 flex items-center justify-between text-xs"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 uppercase">
              {{ d.platform[0] }}
            </div>
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-200">{{ d.name }}</div>
              <div class="text-[11px] text-slate-400 uppercase">{{ d.platform }} • v{{ d.app_version }}</div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-slate-400 text-[11px]">
              {{ d.last_seen_at ? `最近活跃: ${new Date(d.last_seen_at).toLocaleTimeString()}` : '离线' }}
            </span>
            <button
              @click="unbindDevice(d.id)"
              class="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-medium transition-colors"
            >
              解绑
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const profile = ref<any>(null)
const devices = ref<any[]>([])

const loadData = async () => {
  try {
    const devRes: any = await $fetch('/api/goray/v1/web/me/devices')
    devices.value = devRes.data?.devices || []
  } catch {}
}

const unbindDevice = async (id: string) => {
  if (!confirm('确定要解绑并断开该设备吗？')) return
  try {
    await $fetch(`/api/goray/v1/web/me/devices/${id}`, { method: 'DELETE' })
    await loadData()
  } catch (err: any) {
    alert(err.data?.message || '解绑失败')
  }
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadData()
})
</script>
