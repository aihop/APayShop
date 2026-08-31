<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Goray 节点管理</h1>
        <p class="text-xs text-slate-500 mt-1">管理下发给客户端的 VMess / Hysteria2 节点线路及健康状态</p>
      </div>

      <button
        @click="openAddModal"
        class="px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold shadow-sm transition-colors"
      >
        + 新增节点
      </button>
    </div>

    <!-- Nodes Table -->
    <div class="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
          <tr>
            <th class="px-4 py-3">节点名称</th>
            <th class="px-4 py-3">地区 / 协议</th>
            <th class="px-4 py-3">权重 / 排序</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">健康度</th>
            <th class="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-if="nodes.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400">暂无节点数据</td>
          </tr>
          <tr v-for="n in nodes" :key="n.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{{ n.display_name }}</td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
              <span class="font-bold">{{ n.country_code }}</span> {{ n.region || '' }} • <span class="uppercase font-mono">{{ n.protocol }}</span>
            </td>
            <td class="px-4 py-3 font-mono text-slate-500">权重: {{ n.weight }} / 序: {{ n.display_order }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="n.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'">
                {{ n.status }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-[11px]">
              <span :class="n.health_status === 'healthy' ? 'text-emerald-500 font-bold' : 'text-slate-400'">
                {{ n.health_status }}
              </span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button @click="deleteNode(n.id)" class="text-red-500 hover:underline">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Node Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">新增节点线路</h2>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold mb-1">节点名称</label>
            <input v-model="form.display_name" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="香港 01" />
          </div>
          <div>
            <label class="block font-semibold mb-1">国家代码 (2位)</label>
            <input v-model="form.country_code" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 uppercase" placeholder="HK" />
          </div>
          <div>
            <label class="block font-semibold mb-1">服务器域名/IP</label>
            <input v-model="form.server_addr" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="hk1.example.com" />
          </div>
          <div>
            <label class="block font-semibold mb-1">端口</label>
            <input v-model.number="form.server_port" type="number" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="443" />
          </div>
          <div class="col-span-2">
            <label class="block font-semibold mb-1">UUID / 密码</label>
            <input v-model="form.uuid" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </div>
          <div>
            <label class="block font-semibold mb-1">WebSocket Path</label>
            <input v-model="form.ws_path" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="/ws" />
          </div>
          <div>
            <label class="block font-semibold mb-1">TLS SNI</label>
            <input v-model="form.sni" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="hk1.example.com" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showModal = false" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold">取消</button>
          <button @click="submitNode" class="px-4 py-2 rounded-xl bg-[#0066FF] text-white text-xs font-bold">保存并加密存储</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const nodes = ref<any[]>([])
const showModal = ref(false)
const form = ref<any>({
  display_name: '',
  country_code: 'HK',
  protocol: 'vmess',
  server_addr: '',
  server_port: 443,
  uuid: '',
  ws_path: '/ws',
  sni: '',
  weight: 100,
  display_order: 0,
})

const loadNodes = async () => {
  try {
    const res: any = await $fetch('/api/admin/goray/nodes')
    nodes.value = res.data?.nodes || []
  } catch {}
}

const openAddModal = () => {
  form.value = {
    display_name: '',
    country_code: 'HK',
    protocol: 'vmess',
    server_addr: '',
    server_port: 443,
    uuid: '',
    ws_path: '/ws',
    sni: '',
    weight: 100,
    display_order: 0,
  }
  showModal.value = true
}

const submitNode = async () => {
  try {
    await $fetch('/api/admin/goray/nodes', {
      method: 'POST',
      body: form.value,
    })
    showModal.value = false
    await loadNodes()
  } catch (err: any) {
    alert(err.data?.message || '保存节点失败')
  }
}

const deleteNode = async (id: string) => {
  if (!confirm('确定要删除该节点吗？')) return
  try {
    await $fetch(`/api/admin/goray/nodes/${id}`, { method: 'DELETE' })
    await loadNodes()
  } catch (err: any) {
    alert(err.data?.message || '删除失败')
  }
}

onMounted(() => {
  loadNodes()
})
</script>
