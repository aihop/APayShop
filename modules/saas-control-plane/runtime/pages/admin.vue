
<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
            <UIcon name="ph:cloud-check" class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">SaaS 管理</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">统一管理外部 SaaS Provider，不绑定当前官网主题。</p>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-if="connections.length"
          v-model="selectedConnectionId"
          :items="connectionOptions"
          class="min-w-52"
        />
        <UButton color="neutral" variant="outline" icon="ph:arrows-clockwise" :loading="dataPending" @click="refreshActiveData">
          刷新
        </UButton>
        <UButton v-if="canManageConnections" icon="ph:plus" @click="openCreateConnection">添加连接</UButton>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-white/10">
      <UButton
        v-for="item in tabs"
        :key="item.key"
        :color="activeTab === item.key ? 'primary' : 'neutral'"
        :variant="activeTab === item.key ? 'soft' : 'ghost'"
        :icon="item.icon"
        @click="activeTab = item.key"
      >{{ item.label }}</UButton>
    </div>

    <div v-if="pageError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      {{ pageError }}
    </div>

    <section v-if="activeTab === 'overview'" class="space-y-5">
      <div v-if="!connections.length" class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-white/10 dark:bg-[#121214]">
        <UIcon name="ph:plugs-connected" class="mx-auto h-10 w-10 text-gray-400" />
        <h2 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">还没有 SaaS 连接</h2>
        <p class="mt-2 text-sm text-gray-500">添加 Provider 后即可查看租户、套餐和订阅数据。</p>
        <UButton v-if="canManageConnections" class="mt-5" icon="ph:plus" @click="openCreateConnection">添加第一个连接</UButton>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="card in overviewCards" :key="card.label" class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#121214]">
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</div>
          <div class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ card.value }}</div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'connections'" class="space-y-4">
      <div v-for="connection in connections" :key="connection.id" class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#121214]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">{{ connection.name }}</h2>
              <UBadge v-if="connection.isDefault" color="primary" variant="soft">默认</UBadge>
              <UBadge :color="connection.enabled ? 'success' : 'neutral'" variant="soft">{{ connection.enabled ? '已启用' : '已停用' }}</UBadge>
            </div>
            <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{{ providerName(connection.provider) }}</span>
              <span class="truncate">{{ connection.baseUrl }}</span>
              <span>凭证：{{ connection.secretPreview }}</span>
            </div>
          </div>
          <div v-if="canManageConnections" class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" icon="ph:heartbeat" :loading="testingConnectionId === connection.id" @click="testConnection(connection.id)">测试</UButton>
            <UButton color="neutral" variant="outline" icon="ph:pencil-simple" @click="openEditConnection(connection)">编辑</UButton>
            <UButton color="error" variant="soft" icon="ph:trash" @click="deleteConnection(connection)">删除</UButton>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#121214]">
      <div v-if="dataPending" class="p-10 text-center text-sm text-gray-500">正在读取 Provider 数据…</div>
      <div v-else-if="!activeRows.length" class="p-10 text-center text-sm text-gray-500">暂无数据</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-white/[0.03]">
            <tr>
              <th v-for="column in activeColumns" :key="column.key" class="whitespace-nowrap px-4 py-3 font-medium">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-white/5">
            <tr v-for="(row, index) in activeRows" :key="String(row.id ?? index)">
              <td v-for="column in activeColumns" :key="column.key" class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                {{ displayCell(row[column.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="activeTotal > pageSize" class="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-white/10">
        <span class="text-gray-500">共 {{ activeTotal }} 条</span>
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" size="sm" :disabled="page <= 1" @click="changePage(page - 1)">上一页</UButton>
          <span class="px-2 py-1.5 text-gray-600 dark:text-gray-300">第 {{ page }} 页</span>
          <UButton color="neutral" variant="outline" size="sm" :disabled="page * pageSize >= activeTotal" @click="changePage(page + 1)">下一页</UButton>
        </div>
      </div>
    </section>

    <UModal v-model:open="connectionModalOpen">
      <template #content>
        <form class="space-y-5 p-6" @submit.prevent="saveConnection">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ connectionForm.id ? '编辑连接' : '添加连接' }}</h2>
            <p class="mt-1 text-sm text-gray-500">凭证只在服务端加密保存，保存后不可读取原文。</p>
          </div>
          <UFormField label="连接名称" required><UInput v-model="connectionForm.name" class="w-full" /></UFormField>
          <UFormField label="Provider" required>
            <USelect v-model="connectionForm.provider" :items="providerOptions" class="w-full" :disabled="Boolean(connectionForm.id)" />
          </UFormField>
          <UFormField label="API 地址" required hint="例如 https://shoply.example.com">
            <UInput v-model="connectionForm.baseUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField :label="connectionForm.id ? '替换凭证（留空则保持不变）' : '管理凭证'" :required="!connectionForm.id">
            <UInput v-model="connectionForm.secret" type="password" class="w-full" autocomplete="new-password" />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UCheckbox v-model="connectionForm.enabled" label="启用连接" />
            <UCheckbox v-model="connectionForm.isDefault" label="设为默认连接" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" type="button" @click="connectionModalOpen = false">取消</UButton>
            <UButton type="submit" :loading="savingConnection">保存连接</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
type TabKey = 'overview' | 'tenants' | 'plans' | 'subscriptions' | 'connections'
type DataTabKey = Exclude<TabKey, 'overview' | 'connections'>
type DataRow = Record<string, unknown>

interface ProviderInfo {
  code: string
  name: string
  capabilities: string[]
}

interface ConnectionInfo {
  id: string
  name: string
  provider: string
  baseUrl: string
  secretPreview: string
  secretConfigured: boolean
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface ListPayload {
  list: DataRow[]
  total: number
}

definePageMeta({ layout: 'admin', title: 'SaaS 管理' })

const toast = useToast()
const { hasPerm } = useAdminPermissions()
const canManageConnections = computed(() => hasPerm('settings:edit'))
const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'overview', label: '概览', icon: 'ph:squares-four' },
  { key: 'tenants', label: '租户', icon: 'ph:buildings' },
  { key: 'plans', label: '套餐', icon: 'ph:package' },
  { key: 'subscriptions', label: '订阅', icon: 'ph:calendar-check' },
  { key: 'connections', label: '连接设置', icon: 'ph:plugs-connected' },
]
const columns: Record<DataTabKey, Array<{ key: string; label: string }>> = {
  tenants: [
    { key: 'id', label: 'ID' }, { key: 'name', label: '租户' }, { key: 'owner', label: '用户' },
    { key: 'domain', label: '域名' }, { key: 'plan', label: '套餐' }, { key: 'status', label: '状态' },
    { key: 'expiresAt', label: '到期时间' },
  ],
  plans: [
    { key: 'id', label: 'ID' }, { key: 'name', label: '名称' }, { key: 'code', label: '编码' },
    { key: 'price', label: '价格' }, { key: 'currency', label: '币种' }, { key: 'interval', label: '周期' },
    { key: 'status', label: '状态' },
  ],
  subscriptions: [
    { key: 'id', label: 'ID' }, { key: 'owner', label: '用户' }, { key: 'tenantName', label: '租户' },
    { key: 'plan', label: '套餐' }, { key: 'amount', label: '金额' }, { key: 'currency', label: '币种' },
    { key: 'status', label: '订阅状态' }, { key: 'paymentStatus', label: '支付状态' }, { key: 'periodEnd', label: '到期时间' },
  ],
}

const providers = ref<ProviderInfo[]>([])
const connections = ref<ConnectionInfo[]>([])
const selectedConnectionId = ref('')
const activeTab = ref<TabKey>('overview')
const overview = ref<Record<string, unknown>>({})
const rows = ref<Record<DataTabKey, DataRow[]>>({ tenants: [], plans: [], subscriptions: [] })
const totals = ref<Record<DataTabKey, number>>({ tenants: 0, plans: 0, subscriptions: 0 })
const page = ref(1)
const pageSize = 20
const dataPending = ref(false)
const pageError = ref('')
const testingConnectionId = ref('')
const connectionModalOpen = ref(false)
const savingConnection = ref(false)
const connectionForm = reactive({ id: '', name: '', provider: 'shoply', baseUrl: '', secret: '', enabled: true, isDefault: false })

const connectionOptions = computed(() => connections.value.map(item => ({ label: `${item.name}${item.isDefault ? '（默认）' : ''}`, value: item.id })))
const providerOptions = computed(() => providers.value.map(item => ({ label: item.name, value: item.code })))
const providerName = (code: string) => providers.value.find(item => item.code === code)?.name || code
const activeDataTab = computed<DataTabKey | null>(() => ['tenants', 'plans', 'subscriptions'].includes(activeTab.value) ? activeTab.value as DataTabKey : null)
const activeRows = computed(() => activeDataTab.value ? rows.value[activeDataTab.value] : [])
const activeTotal = computed(() => activeDataTab.value ? totals.value[activeDataTab.value] : 0)
const activeColumns = computed(() => activeDataTab.value ? columns[activeDataTab.value] : [])
const overviewCards = computed(() => [
  { label: '租户总数', value: displayCell(overview.value.totalTenants) },
  { label: '新增租户', value: displayCell(overview.value.newTenants) },
  { label: '有效订阅', value: displayCell(overview.value.activeSubscriptions) },
  { label: '即将到期', value: displayCell(overview.value.expiringSubscriptions) },
  { label: '本月收入', value: displayCell(overview.value.monthlyRevenue) },
  { label: '上月收入', value: displayCell(overview.value.previousMonthlyRevenue) },
])

const displayCell = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value)
const errorMessage = (error: unknown) => {
  if (!error || typeof error !== 'object') return '请求失败'
  const candidate = error as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string }
  return candidate.data?.statusMessage || candidate.data?.message || candidate.statusMessage || candidate.message || '请求失败'
}

const loadMetadata = async () => {
  const [providerResult, connectionResult] = await Promise.all([
    $fetch<{ providers: ProviderInfo[] }>('/api/saas-control-plane/admin/providers', { headers: ssrHeaders }),
    $fetch<{ connections: ConnectionInfo[] }>('/api/saas-control-plane/admin/connections', { headers: ssrHeaders }),
  ])
  providers.value = providerResult.providers
  connections.value = connectionResult.connections
  if (!connections.value.some(item => item.id === selectedConnectionId.value)) {
    selectedConnectionId.value = connections.value.find(item => item.isDefault)?.id || connections.value[0]?.id || ''
  }
}

const loadData = async (tab: Exclude<TabKey, 'connections'>) => {
  if (!selectedConnectionId.value) return
  dataPending.value = true
  pageError.value = ''
  try {
    const query = new URLSearchParams({ connectionId: selectedConnectionId.value })
    if (tab !== 'overview') {
      query.set('page', String(page.value))
      query.set('limit', String(pageSize))
    }
    const result = await $fetch<{ data: Record<string, unknown> | ListPayload }>(`/api/saas-control-plane/admin/data/${tab}?${query}`, { headers: ssrHeaders })
    if (tab === 'overview') overview.value = result.data as Record<string, unknown>
    else {
      const list = result.data as ListPayload
      rows.value[tab] = list.list
      totals.value[tab] = list.total
    }
  } catch (error) {
    pageError.value = errorMessage(error)
  } finally {
    dataPending.value = false
  }
}

const refreshActiveData = async () => {
  if (activeTab.value === 'connections') return loadMetadata()
  await loadData(activeTab.value)
}

const changePage = async (nextPage: number) => {
  page.value = nextPage
  if (activeDataTab.value) await loadData(activeDataTab.value)
}

const openCreateConnection = () => {
  Object.assign(connectionForm, { id: '', name: '', provider: providers.value[0]?.code || 'shoply', baseUrl: '', secret: '', enabled: true, isDefault: connections.value.length === 0 })
  connectionModalOpen.value = true
}

const openEditConnection = (connection: ConnectionInfo) => {
  Object.assign(connectionForm, { ...connection, secret: '' })
  connectionModalOpen.value = true
}

const saveConnection = async () => {
  savingConnection.value = true
  try {
    const id = connectionForm.id
    const url = id ? `/api/saas-control-plane/admin/connections/${encodeURIComponent(id)}` : '/api/saas-control-plane/admin/connections'
    const result = await $fetch<{ connection: ConnectionInfo }>(url, { method: id ? 'PUT' : 'POST', body: connectionForm, headers: ssrHeaders })
    connectionModalOpen.value = false
    selectedConnectionId.value = result.connection.id
    await loadMetadata()
    toast.add({ title: '连接已保存', color: 'success' })
    if (activeTab.value === 'overview') await loadData('overview')
  } catch (error) {
    toast.add({ title: '保存失败', description: errorMessage(error), color: 'error' })
  } finally {
    savingConnection.value = false
  }
}

const testConnection = async (id: string) => {
  testingConnectionId.value = id
  try {
    const result = await $fetch<{ result: { message: string } }>(`/api/saas-control-plane/admin/connections/${encodeURIComponent(id)}/test`, { method: 'POST', headers: ssrHeaders })
    toast.add({ title: '连接正常', description: result.result.message, color: 'success' })
  } catch (error) {
    toast.add({ title: '连接失败', description: errorMessage(error), color: 'error' })
  } finally {
    testingConnectionId.value = ''
  }
}

const deleteConnection = async (connection: ConnectionInfo) => {
  if (!window.confirm(`确认删除连接“${connection.name}”吗？`)) return
  try {
    await $fetch(`/api/saas-control-plane/admin/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE', headers: ssrHeaders })
    await loadMetadata()
    toast.add({ title: '连接已删除', color: 'success' })
  } catch (error) {
    toast.add({ title: '删除失败', description: errorMessage(error), color: 'error' })
  }
}

watch(activeTab, async (tab) => {
  page.value = 1
  if (tab !== 'connections') await loadData(tab)
})
watch(selectedConnectionId, async (id, previous) => {
  if (id && previous) await refreshActiveData()
})

await useAsyncData('saas-control-plane-bootstrap', async () => {
  await loadMetadata()
  if (selectedConnectionId.value) await loadData('overview')
  return true
})
</script>
