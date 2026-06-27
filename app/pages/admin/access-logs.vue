<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.accessLogs.page.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.accessLogs.page.subtitle') }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative w-64">
        <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          v-model="search"
          :placeholder="$t('admin.accessLogs.filter.search')"
          class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          @input="debouncedSearch"
        />
      </div>
      <USelectMenu
        v-model="methodFilter"
        :items="methodOptions"
        class="w-28"
        size="sm"
        @update:model-value="onFilterChange"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusOptions"
        class="w-28"
        size="sm"
        @update:model-value="onFilterChange"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="ph:arrows-clockwise"
        size="sm"
        @click="refresh"
      >{{ $t('admin.accessLogs.filter.refresh') }}</UButton>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="logs"
          :columns="columns"
          :loading="pending"
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

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.common.showing') }} {{ logs.length > 0 ? (page - 1) * pageSize + 1 : 0 }}
          {{ $t('admin.common.to') }}
          {{ Math.min(page * pageSize, totalItems) }}
          {{ $t('admin.common.of') }} {{ totalItems }}
          {{ $t('admin.common.results') }}
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :page-count="pageSize"
          :max="5"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

definePageMeta({ title: 'Access Logs' })
const { t } = useI18n()
const { formatDateTime } = useFormatTime()

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'path', header: t('admin.accessLogs.table.path') },
  { accessorKey: 'method', header: t('admin.accessLogs.table.method') },
  { accessorKey: 'statusCode', header: t('admin.accessLogs.table.status') },
  { accessorKey: 'duration', header: t('admin.accessLogs.table.duration') },
  { accessorKey: 'ip', header: 'IP' },
  { accessorKey: 'visitorId', header: t('admin.accessLogs.table.visitor') },
  { accessorKey: 'createdAt', header: t('admin.accessLogs.table.time') },
]

const { page, pageSize, onPageChange } = usePagination(50)

// Filters
const search = ref('')
const methodFilter = ref('')
const statusFilter = ref('')

const methodOptions = [
  { label: t('admin.accessLogs.filter.allMethods'), value: '' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
]

const statusOptions = [
  { label: t('admin.accessLogs.filter.allStatus'), value: '' },
  { label: '2xx', value: '2' },
  { label: '3xx', value: '3' },
  { label: '4xx', value: '4' },
  { label: '5xx', value: '5' },
]

let debounceTimer: ReturnType<typeof setTimeout>
const debouncedSearch = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    refresh()
  }, 400)
}

const onFilterChange = () => {
  page.value = 1
  refresh()
}

const queryParams = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  ...(search.value ? { search: search.value } : {}),
  ...(methodFilter.value ? { method: methodFilter.value } : {}),
  ...(statusFilter.value ? { status: statusFilter.value } : {}),
}))

const { data, pending, refresh } = await useFetch<any>('/api/admin/access-logs', {
  query: queryParams,
  watch: [queryParams],
})

const logs = computed<any[]>(() => data.value?.logs || [])
const totalItems = computed(() => data.value?.total || 0)

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
