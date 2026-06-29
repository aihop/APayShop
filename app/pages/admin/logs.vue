<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ headerTitle }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ headerSubtitle }}</p>
      </div>
      <UButton
        v-if="tab === 'system'"
        color="error"
        variant="outline"
        icon="ph:trash-bold"
        @click="clearAllLogs"
        :loading="isClearing"
      >{{ $t('admin.logs.page.clear_all') }}</UButton>
    </div>

    <UTabs v-model="tab" :items="tabItems" class="mb-4" />

    <!-- ============ System Logs ============ -->
    <template v-if="tab === 'system'">
      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
        <div class="flex-1 overflow-auto">
          <UTable
            :data="systemLogs"
            :columns="systemColumns"
            :loading="systemPending"
            sticky
          >
            <template #level-cell="{ row }">
              <UBadge
                :color="getLevelColor(row.original.level)"
                variant="subtle"
                size="sm"
                class="uppercase font-semibold tracking-wider"
              >
                {{ row.original.level }}
              </UBadge>
            </template>

            <template #source-cell="{ row }">
              <span class="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                {{ row.original.source || $t('admin.logs.system_fallback') }}
              </span>
            </template>

            <template #message-cell="{ row }">
              <div class="flex flex-col gap-1 max-w-lg">
                <span class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{{ row.original.message }}</span>
                <span
                  v-if="row.original.details"
                  class="text-xs text-gray-500 line-clamp-1 truncate cursor-help"
                  :title="row.original.details"
                >
                  {{ row.original.details }}
                </span>
              </div>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center gap-2">
                <UButton
                  v-if="row.original.details"
                  color="neutral"
                  variant="ghost"
                  icon="ph:eye"
                  size="sm"
                  @click="viewDetails(row.original)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="ph:trash"
                  size="sm"
                  @click="deleteLog(row.original.id)"
                />
              </div>
            </template>
          </UTable>
        </div>

        <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('admin.logs.pagination.showing') }} {{ systemLogs.length > 0 ? (systemPage - 1) * systemPageSize + 1 : 0 }}
            {{ $t('admin.logs.pagination.to') }}
            {{ Math.min(systemPage * systemPageSize, systemTotalItems) }}
            {{ $t('admin.logs.pagination.of') }} {{ systemTotalItems }}
            {{ $t('admin.logs.pagination.entries') }}
          </span>
          <UPagination
            v-model="systemPage"
            :total="systemTotalItems"
            :page-count="systemPageSize"
            :max="5"
            @update:page="(val) => onSystemPageChange(val, () => systemRefresh())"
          />
        </div>
      </div>

      <!-- Details Modal -->
      <UModal v-model:open="isDetailsOpen">
        <template #content>
          <UCard
            class="bg-white dark:bg-[#121214] ring-1 ring-gray-200 dark:ring-gray-800"
          >
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <UIcon
                    name="ph:terminal-window"
                    class="w-5 h-5 text-gray-500 dark:text-gray-400"
                  />
                  {{ $t('admin.logs.detail.title') }}
                </h3>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="ph:x"
                  class="-my-1"
                  @click="isDetailsOpen = false"
                />
              </div>
            </template>

            <div class="space-y-4">
              <div>
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.logs.detail.message') }}</div>
                <div class="text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                  {{ selectedLog?.message }}
                </div>
              </div>

              <div>
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.logs.detail.technical_details') }}</div>
                <div class="bg-black p-4 rounded-lg border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-96">
                  <pre class="text-xs font-mono text-gray-500 dark:text-gray-300 whitespace-pre-wrap">{{ formatDetails(selectedLog?.details) }}</pre>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.logs.detail.source') }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-300">{{ selectedLog?.source || $t('admin.logs.system_fallback') }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.logs.detail.time') }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-300">{{ selectedLog ? formatDateTime(selectedLog.createdAt) : '' }}</div>
                </div>
              </div>
            </div>
          </UCard>
        </template>
      </UModal>
    </template>

    <!-- ============ Access Logs ============ -->
    <template v-if="tab === 'access'">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="relative w-64">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="accessSearch"
            :placeholder="$t('admin.accessLogs.filter.search')"
            class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            @input="debouncedAccessSearch"
          />
        </div>
        <USelectMenu
          v-model="accessMethodFilter"
          :items="accessMethodOptions"
          class="w-28"
          size="sm"
          @update:model-value="onAccessFilterChange"
        />
        <USelectMenu
          v-model="accessStatusFilter"
          :items="accessStatusOptions"
          class="w-28"
          size="sm"
          @update:model-value="onAccessFilterChange"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          size="sm"
          @click="accessRefresh"
        >{{ $t('admin.accessLogs.filter.refresh') }}</UButton>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
        <div class="flex-1 overflow-auto">
          <UTable
            :data="accessLogs"
            :columns="accessColumns"
            :loading="accessPending"
            sticky
          >
            <template #path-cell="{ row }">
              <div class="max-w-xs truncate font-mono text-xs" :title="row.original.path">
                {{ row.original.path }}
              </div>
            </template>

            <template #method-cell="{ row }">
              <UBadge
                :color="getMethodColor(row.original.method)"
                variant="subtle"
                size="sm"
                class="font-mono"
              >
                {{ row.original.method }}
              </UBadge>
            </template>

            <template #statusCode-cell="{ row }">
              <span
                class="font-mono text-xs px-2 py-0.5 rounded"
                :class="getStatusCodeClass(row.original.statusCode)"
              >
                {{ row.original.statusCode || '-' }}
              </span>
            </template>

            <template #duration-cell="{ row }">
              <span class="text-gray-500 dark:text-gray-400 text-xs font-mono">
                {{ row.original.duration != null ? `${row.original.duration.toFixed(0)}ms` : '-' }}
              </span>
            </template>

            <template #ip-cell="{ row }">
              <span class="text-xs font-mono text-gray-500 dark:text-gray-400">
                {{ row.original.ip || '-' }}
              </span>
            </template>

            <template #visitorId-cell="{ row }">
              <span class="text-xs font-mono text-gray-400" :title="row.original.visitorId">
                {{ row.original.visitorId ? shortId(row.original.visitorId) : '-' }}
              </span>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
            </template>
          </UTable>
        </div>

        <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('admin.common.showing') }} {{ accessLogs.length > 0 ? (accessPage - 1) * accessPageSize + 1 : 0 }}
            {{ $t('admin.common.to') }}
            {{ Math.min(accessPage * accessPageSize, accessTotalItems) }}
            {{ $t('admin.common.of') }} {{ accessTotalItems }}
            {{ $t('admin.common.results') }}
          </span>
          <UPagination
            v-model="accessPage"
            :total="accessTotalItems"
            :page-count="accessPageSize"
            :max="5"
            @update:page="(val) => onAccessPageChange(val, () => accessRefresh())"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ title: 'Logs' })
const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()
const { confirm } = useConfirm()

// Tab state
const route = useRoute()
const tab = ref(route.query.tab === 'access' ? 'access' : 'system')
const tabItems = computed(() => [
  { label: t('admin.logs.page.title'), icon: 'ph:terminal-window', value: 'system' },
  { label: t('admin.accessLogs.page.title'), icon: 'ph:binoculars', value: 'access' },
])
const headerTitle = computed(() =>
  tab.value === 'system' ? t('admin.logs.page.title') : t('admin.accessLogs.page.title')
)
const headerSubtitle = computed(() =>
  tab.value === 'system' ? t('admin.logs.page.subtitle') : t('admin.accessLogs.page.subtitle')
)

// ==================== System Logs ====================
const systemColumns = [
  { accessorKey: 'id', header: t('admin.logs.table.id') },
  { accessorKey: 'level', header: t('admin.logs.table.level') },
  { accessorKey: 'source', header: t('admin.logs.table.source') },
  { accessorKey: 'message', header: t('admin.logs.table.message') },
  { accessorKey: 'createdAt', header: t('admin.logs.table.timestamp') },
  {
    accessorKey: 'actions',
    header: t('admin.logs.table.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
      },
    },
  },
]

const { page: systemPage, pageSize: systemPageSize, onPageChange: onSystemPageChange } = usePagination(15)
const isClearing = ref(false)
const isDetailsOpen = ref(false)
const selectedLog = ref<Record<string, any> | null>(null)

const { data: systemData, pending: systemPending, refresh: systemRefresh } = await useFetch<any>('/api/admin/logs', {
  query: {
    page: systemPage,
    pageSize: systemPageSize,
  },
  watch: [systemPage],
})

const systemLogs = computed<any[]>(() => systemData.value?.logs || [])
const systemTotalItems = computed(() => systemData.value?.total || 0)

const getLevelColor = (level?: string): 'error' | 'warning' | 'neutral' | 'primary' => {
  switch (level?.toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
      return 'warning'
    case 'debug':
      return 'neutral'
    case 'info':
    default:
      return 'primary'
  }
}

const formatDetails = (details: unknown) => {
  if (typeof details !== 'string' || !details) return ''
  try {
    return JSON.stringify(JSON.parse(details), null, 2)
  } catch (e) {
    return details
  }
}

const viewDetails = (log: any) => {
  selectedLog.value = log
  isDetailsOpen.value = true
}

const deleteLog = async (id: number) => {
  const isConfirmed = await confirm({
    title: t('admin.logs.confirm.delete_title'),
    description: t('admin.logs.confirm.delete_desc'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/logs/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('admin.logs.toast.success'),
      description: t('admin.logs.toast.deleted'),
      color: 'success',
    })
    systemRefresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.logs.toast.error'),
      description: e.data?.message || t('admin.logs.toast.delete_failed'),
      color: 'error',
    })
  }
}

const clearAllLogs = async () => {
  const isConfirmed = await confirm({
    title: t('admin.logs.confirm.clear_title'),
    description: t('admin.logs.confirm.clear_desc'),
  })

  if (!isConfirmed) return

  isClearing.value = true
  try {
    await $fetch('/api/admin/logs/clear', {
      method: 'DELETE',
    })
    toast.add({
      title: t('admin.logs.toast.success'),
      description: t('admin.logs.toast.cleared'),
      color: 'success',
    })
    systemPage.value = 1
    systemRefresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.logs.toast.error'),
      description: e.data?.message || t('admin.logs.toast.clear_failed'),
      color: 'error',
    })
  } finally {
    isClearing.value = false
  }
}

// ==================== Access Logs ====================
const accessColumns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'path', header: t('admin.accessLogs.table.path') },
  { accessorKey: 'method', header: t('admin.accessLogs.table.method') },
  { accessorKey: 'statusCode', header: t('admin.accessLogs.table.status') },
  { accessorKey: 'duration', header: t('admin.accessLogs.table.duration') },
  { accessorKey: 'ip', header: 'IP' },
  { accessorKey: 'visitorId', header: t('admin.accessLogs.table.visitor') },
  { accessorKey: 'createdAt', header: t('admin.accessLogs.table.time') },
]

const { page: accessPage, pageSize: accessPageSize, onPageChange: onAccessPageChange } = usePagination(50)

const accessSearch = ref('')
const accessMethodFilter = ref('')
const accessStatusFilter = ref('')

const accessMethodOptions = [
  { label: t('admin.accessLogs.filter.allMethods'), value: '' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
]

const accessStatusOptions = [
  { label: t('admin.accessLogs.filter.allStatus'), value: '' },
  { label: '2xx', value: '2' },
  { label: '3xx', value: '3' },
  { label: '4xx', value: '4' },
  { label: '5xx', value: '5' },
]

let accessDebounceTimer: ReturnType<typeof setTimeout>
const debouncedAccessSearch = () => {
  clearTimeout(accessDebounceTimer)
  accessDebounceTimer = setTimeout(() => {
    accessPage.value = 1
    accessRefresh()
  }, 400)
}

const onAccessFilterChange = () => {
  accessPage.value = 1
  accessRefresh()
}

const accessQueryParams = computed(() => ({
  page: accessPage.value,
  pageSize: accessPageSize.value,
  ...(accessSearch.value ? { search: accessSearch.value } : {}),
  ...(accessMethodFilter.value ? { method: accessMethodFilter.value } : {}),
  ...(accessStatusFilter.value ? { status: accessStatusFilter.value } : {}),
}))

const { data: accessData, pending: accessPending, refresh: accessRefresh } = await useFetch<any>('/api/admin/access-logs', {
  query: accessQueryParams,
  watch: [accessQueryParams],
})

const accessLogs = computed<any[]>(() => accessData.value?.logs || [])
const accessTotalItems = computed(() => accessData.value?.total || 0)

const getMethodColor = (method?: string): 'neutral' | 'primary' | 'warning' | 'success' | 'error' => {
  switch (method?.toUpperCase()) {
    case 'GET': return 'success'
    case 'POST': return 'primary'
    case 'PUT': return 'warning'
    case 'DELETE': return 'error'
    case 'PATCH': return 'warning'
    default: return 'neutral'
  }
}

const getStatusCodeClass = (code?: number) => {
  if (!code) return 'text-gray-500 bg-gray-100 dark:bg-gray-900'
  if (code < 300) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
  if (code < 400) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
  if (code < 500) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
}

const shortId = (id: string) => {
  if (!id || id.length <= 12) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}
</script>
