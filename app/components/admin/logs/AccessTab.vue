<template>
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
      value-key="value"
      class="w-28"
      size="sm"
      @update:model-value="onFilterChange"
    />
    <USelectMenu
      v-model="statusFilter"
      :items="statusOptions"
      value-key="value"
      class="w-28"
      size="sm"
      @update:model-value="onFilterChange"
    />
    <UButton
      color="neutral"
      variant="outline"
      icon="ph:arrows-clockwise"
      size="sm"
      @click="() => refresh()"
    >{{ $t('admin.accessLogs.filter.refresh') }}</UButton>
  </div>

  <AdminLogsTableCard
    :page="page"
    :page-size="pageSize"
    :total="totalItems"
    :row-count="logs.length"
    @update:page="(val) => onPageChange(val, () => refresh())"
  >
    <UTable :data="logs" :columns="columns" :loading="pending" sticky>
      <template #path-cell="{ row }">
        <div class="max-w-xs truncate font-mono text-xs" :title="row.original.path">
          {{ row.original.path }}
        </div>
      </template>

      <template #method-cell="{ row }">
        <UBadge :color="getMethodColor(row.original.method)" variant="subtle" size="sm" class="font-mono">
          {{ row.original.method }}
        </UBadge>
      </template>

      <template #statusCode-cell="{ row }">
        <span class="font-mono text-xs px-2 py-0.5 rounded" :class="getStatusCodeClass(row.original.statusCode)">
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
  </AdminLogsTableCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const { getMethodColor, getStatusCodeClass, shortId } = useLogFormatters()

const columns = computed(() => [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'path', header: t('admin.accessLogs.table.path') },
  { accessorKey: 'method', header: t('admin.accessLogs.table.method') },
  { accessorKey: 'statusCode', header: t('admin.accessLogs.table.status') },
  { accessorKey: 'duration', header: t('admin.accessLogs.table.duration') },
  { accessorKey: 'ip', header: 'IP' },
  { accessorKey: 'visitorId', header: t('admin.accessLogs.table.visitor') },
  { accessorKey: 'createdAt', header: t('admin.accessLogs.table.time') },
])

const { page, pageSize, onPageChange } = usePagination(50)

// Reka UI reserves the empty string for "clear the selection", so an option
// with value: '' throws as soon as the dropdown is opened. Use a sentinel for
// "no filter" and translate it back when building the query.
const ALL = 'all'

const search = ref('')
const methodFilter = ref(ALL)
const statusFilter = ref(ALL)

const methodOptions = [
  { label: t('admin.accessLogs.filter.allMethods'), value: ALL },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
]

const statusOptions = [
  { label: t('admin.accessLogs.filter.allStatus'), value: ALL },
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
  ...(methodFilter.value !== ALL ? { method: methodFilter.value } : {}),
  ...(statusFilter.value !== ALL ? { status: statusFilter.value } : {}),
}))

const { data, pending, refresh } = useFetch<any>('/api/admin/access-logs', {
  query: queryParams,
  watch: [queryParams],
  lazy: true,
})

const logs = computed<any[]>(() => data.value?.logs || [])
const totalItems = computed(() => data.value?.total || 0)
</script>
