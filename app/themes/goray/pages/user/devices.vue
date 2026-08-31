<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
    <div class="flex items-center justify-between mb-8">
      <div>
        <NuxtLink to="/user/dashboard" class="text-xs text-[#0066FF] hover:underline mb-1 inline-block">
          ← 返回控制面板
        </NuxtLink>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">授权设备管理</h1>
      </div>

      <NuxtLink
        to="/activate"
        class="px-3.5 py-1.5 rounded-xl bg-[#0066FF] text-white text-xs font-semibold hover:bg-[#0052CC] transition-colors"
      >
        + 绑定新设备
      </NuxtLink>
    </div>

    <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div v-if="devices.length === 0" class="text-center py-12 text-xs text-slate-400">
        您尚未授权任何设备。
      </div>

      <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="d in devices"
          :key="d.id"
          class="py-4 flex items-center justify-between text-xs"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] flex items-center justify-center font-bold text-sm uppercase">
              {{ d.platform[0] }}
            </div>
            <div>
              <div class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {{ d.name }}
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="d.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-slate-100 text-slate-500'">
                  {{ d.status === 'active' ? '在线' : '已解绑' }}
                </span>
              </div>
              <div class="text-xs text-slate-400 mt-0.5 uppercase">
                {{ d.platform }} • v{{ d.app_version }} • 首次授权: {{ new Date(d.created_at).toLocaleDateString() }}
              </div>
            </div>
          </div>

          <button
            v-if="d.status === 'active'"
            @click="unbindDevice(d.id)"
            class="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition-colors"
          >
            强制解绑
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const devices = ref<any[]>([])

const loadDevices = async () => {
  try {
    const res: any = await $fetch('/api/goray/v1/web/me/devices')
    devices.value = res.data?.devices || []
  } catch {}
}

const unbindDevice = async (id: string) => {
  if (!confirm('确定要解绑该设备吗？解绑后该设备将立即断开 VPN 连接。')) return
  try {
    await $fetch(`/api/goray/v1/web/me/devices/${id}`, { method: 'DELETE' })
    await loadDevices()
  } catch (err: any) {
    alert(err.data?.message || '解绑失败')
  }
}

onMounted(() => {
  loadDevices()
})
</script>
