<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">在线设备会话</h1>
      <p class="text-xs text-slate-500 mt-1">查看所有已授权设备的 DPoP 密钥状态与最近在线时间</p>
    </div>

    <div class="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
          <tr>
            <th class="px-4 py-3">用户邮箱</th>
            <th class="px-4 py-3">设备名称</th>
            <th class="px-4 py-3">平台 / 版本</th>
            <th class="px-4 py-3">DPoP 指纹</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">最近活跃</th>
            <th class="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-if="devices.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-slate-400">暂无在线设备记录</td>
          </tr>
          <tr v-for="d in devices" :key="d.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{{ d.user_email }}</td>
            <td class="px-4 py-3">{{ d.name }}</td>
            <td class="px-4 py-3 uppercase">{{ d.platform }} • v{{ d.app_version }}</td>
            <td class="px-4 py-3 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">{{ d.proof_key_jkt }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="d.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'">
                {{ d.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500 text-[11px]">{{ d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '从不' }}</td>
            <td class="px-4 py-3 text-right">
              <button @click="forceRevoke(d.id)" class="text-red-500 hover:underline">踢下线</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const devices = ref<any[]>([])

const loadDevices = async () => {
  try {
    const res: any = await $fetch('/api/admin/goray/devices')
    devices.value = res.data?.devices || []
  } catch {}
}

const forceRevoke = async (id: string) => {
  if (!confirm('确定要强制将该设备踢下线吗？')) return
  try {
    await $fetch(`/api/admin/goray/devices/${id}`, { method: 'DELETE' })
    await loadDevices()
  } catch (err: any) {
    alert(err.data?.message || '操作失败')
  }
}

onMounted(() => {
  loadDevices()
})
</script>
