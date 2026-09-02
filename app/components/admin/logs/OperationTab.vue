<template>
  <!-- Retention prune, never a "clear all" — an audit trail the audited party
       can wipe on demand isn't an audit trail. Enforced server-side too, in
       server/api/admin/operation-logs/cleanup.post.ts -->
  <Teleport to="#logs-header-actions" defer>
    <div v-if="hasAdminPerm('logs:edit')" class="flex items-end gap-2">
      <div class="flex flex-col gap-1">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.operationLogs.cleanup.keepDays') }}</span>
        <UInput v-model.number="cleanupDays" type="number" :min="30" :max="730" size="sm" class="w-24" />
      </div>
      <UButton
        color="error"
        variant="outline"
        icon="ph:broom"
        size="sm"
        :loading="isPruning"
        @click="pruneLogs"
      >{{ $t('admin.operationLogs.filter.cleanup') }}</UButton>
    </div>
  </Teleport>

  <div class="mb-4 flex flex-wrap items-center gap-3">
    <div class="relative w-64">
      <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        v-model="search"
        :placeholder="$t('admin.operationLogs.filter.search')"
        class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        @input="debouncedSearch"
      />
    </div>
    <USelectMenu
      v-model="actorTypeFilter"
      :items="actorTypeOptions"
      value-key="value"
      class="w-36"
      size="sm"
      @update:model-value="onFilterChange"
    />
    <USelectMenu
      v-model="resourceFilter"
      :items="resourceOptions"
      value-key="value"
      class="w-40"
      size="sm"
      @update:model-value="onFilterChange"
    />
    <USelectMenu
      v-model="actionFilter"
      :items="actionOptions"
      value-key="value"
      class="w-40"
      size="sm"
      @update:model-value="onFilterChange"
    />
    <UButton
      color="neutral"
      variant="outline"
      icon="ph:arrows-clockwise"
      size="sm"
      @click="() => refresh()"
    >{{ $t('admin.operationLogs.filter.refresh') }}</UButton>
  </div>

  <AdminLogsTableCard
    :page="page"
    :page-size="pageSize"
    :total="totalItems"
    :row-count="logs.length"
    @update:page="(val) => onPageChange(val, () => refresh())"
  >
    <UTable :data="logs" :columns="columns" :loading="pending" sticky>
      <template #actorName-cell="{ row }">
        <div class="flex items-center gap-2">
          <UBadge :color="getActorColor(row.original.actorType)" variant="subtle" size="sm">
            {{ actorTypeLabel(row.original.actorType) }}
          </UBadge>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ row.original.actorName || $t('admin.operationLogs.actor.unknown') }}
          </span>
        </div>
      </template>

      <template #action-cell="{ row }">
        <UBadge :color="getActionColor(row.original.action)" variant="subtle" size="sm" class="font-semibold">
          {{ actionLabel(row.original.action) }}
        </UBadge>
      </template>

      <template #resource-cell="{ row }">
        <span class="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
          {{ row.original.resource }}
        </span>
      </template>

      <template #target-cell="{ row }">
        <div class="flex flex-col gap-0.5 max-w-xs">
          <span
            v-if="row.original.summary"
            class="text-sm text-gray-900 dark:text-white line-clamp-1"
            :title="row.original.summary"
          >{{ row.original.summary }}</span>
          <span
            class="text-xs font-mono text-gray-400 truncate"
            :title="`${row.original.method} ${row.original.path}`"
          >
            {{ row.original.resourceId ? `#${shortId(row.original.resourceId)}` : row.original.path }}
          </span>
        </div>
      </template>

      <template #statusCode-cell="{ row }">
        <span class="font-mono text-xs px-2 py-0.5 rounded" :class="getStatusCodeClass(row.original.statusCode)">
          {{ row.original.statusCode || '-' }}
        </span>
      </template>

      <template #ip-cell="{ row }">
        <span class="text-xs font-mono text-gray-500 dark:text-gray-400">
          {{ row.original.ip || '-' }}
        </span>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
          {{ formatDateTime(row.original.createdAt) }}
        </span>
      </template>

      <template #opActions-cell="{ row }">
        <UButton color="neutral" variant="ghost" icon="ph:eye" size="sm" @click="viewOperation(row.original)" />
      </template>
    </UTable>
  </AdminLogsTableCard>

  <UModal v-model:open="isDetailsOpen">
    <template #content>
      <UCard class="bg-white dark:bg-[#121214] ring-1 ring-gray-200 dark:ring-gray-800">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="ph:clipboard-text" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              {{ $t('admin.operationLogs.detail.title') }}
            </h3>
            <UButton color="neutral" variant="ghost" icon="ph:x" class="-my-1" @click="isDetailsOpen = false" />
          </div>
        </template>

        <div class="space-y-4">
          <div v-if="selected?.summary">
            <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.summary') }}</div>
            <div class="text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
              {{ selected.summary }}
            </div>
          </div>

          <div>
            <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.payload') }}</div>
            <div class="bg-black p-4 rounded-lg border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-96">
              <pre class="text-xs font-mono text-gray-500 dark:text-gray-300 whitespace-pre-wrap">{{ formatDetails(selected?.details) || $t('admin.operationLogs.detail.noDetails') }}</pre>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.actor') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-300">
                {{ actorTypeLabel(selected?.actorType) }} ·
                {{ selected?.actorName || $t('admin.operationLogs.actor.unknown') }}
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.time') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-300">{{ selected ? formatDateTime(selected.createdAt) : '' }}</div>
            </div>
            <div class="col-span-2">
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.request') }}</div>
              <div class="text-sm font-mono text-gray-500 dark:text-gray-300 break-all">
                {{ selected?.method }} {{ selected?.path }}
                <span v-if="selected?.statusCode"> → {{ selected.statusCode }}</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.ip') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-300">{{ selected?.ip || '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">{{ $t('admin.operationLogs.detail.userAgent') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-300 line-clamp-2" :title="selected?.userAgent">
                {{ selected?.userAgent || '-' }}
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const { t, te } = useI18n()
const { formatDateTime } = useFormatTime()
const { getStatusCodeClass, formatDetails, shortId } = useLogFormatters()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const toast = useToast()
const { confirm } = useConfirm()

const columns = computed(() => [
  { accessorKey: 'actorName', header: t('admin.operationLogs.table.actor') },
  { accessorKey: 'action', header: t('admin.operationLogs.table.action') },
  { accessorKey: 'resource', header: t('admin.operationLogs.table.resource') },
  { accessorKey: 'target', header: t('admin.operationLogs.table.target') },
  { accessorKey: 'statusCode', header: t('admin.operationLogs.table.status') },
  { accessorKey: 'ip', header: t('admin.operationLogs.table.ip') },
  { accessorKey: 'createdAt', header: t('admin.operationLogs.table.time') },
  { accessorKey: 'opActions', header: t('admin.operationLogs.table.actions') },
])

const { page, pageSize, onPageChange } = usePagination(50)

// Reka UI reserves the empty string for "clear the selection", so an option
// with value: '' throws as soon as the dropdown is opened. Use a sentinel for
// "no filter" and translate it back when building the query.
const ALL = 'all'

const search = ref('')
const actorTypeFilter = ref(ALL)
const actionFilter = ref(ALL)
const resourceFilter = ref(ALL)
const isDetailsOpen = ref(false)
const selected = ref<Record<string, any> | null>(null)
const cleanupDays = ref(180)
const isPruning = ref(false)

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
  ...(actorTypeFilter.value !== ALL ? { actorType: actorTypeFilter.value } : {}),
  ...(actionFilter.value !== ALL ? { action: actionFilter.value } : {}),
  ...(resourceFilter.value !== ALL ? { resource: resourceFilter.value } : {}),
}))

const { data, pending, refresh } = useFetch<any>('/api/admin/operation-logs', {
  query: queryParams,
  watch: [queryParams],
  lazy: true,
})

const logs = computed<any[]>(() => data.value?.logs || [])
const totalItems = computed(() => data.value?.total || 0)

// Actions and resources are open-ended (derived from request URLs, including
// theme-added admin routes), so fall back to the raw value when untranslated.
const actionLabel = (action?: string) => {
  if (!action) return '-'
  const key = `admin.operationLogs.action.${action}`
  return te(key) ? t(key) : action
}

const actorTypeLabel = (actorType?: string) => {
  if (!actorType) return t('admin.operationLogs.actor.unknown')
  const key = `admin.operationLogs.actor.${actorType}`
  return te(key) ? t(key) : actorType
}

const actorTypeOptions = computed(() => [
  { label: t('admin.operationLogs.filter.allActors'), value: ALL },
  { label: t('admin.operationLogs.actor.admin'), value: 'admin' },
  { label: t('admin.operationLogs.actor.user'), value: 'user' },
  { label: t('admin.operationLogs.actor.system'), value: 'system' },
])

// Driven by what's actually recorded, so a new admin route appears in the
// filters without a code change here.
const resourceOptions = computed(() => [
  { label: t('admin.operationLogs.filter.allResources'), value: ALL },
  ...(data.value?.facets?.resources || []).map((r: string) => ({ label: r, value: r })),
])

const actionOptions = computed(() => [
  { label: t('admin.operationLogs.filter.allActions'), value: ALL },
  ...(data.value?.facets?.actions || []).map((a: string) => ({ label: actionLabel(a), value: a })),
])

const getActorColor = (actorType?: string): 'primary' | 'success' | 'neutral' => {
  switch (actorType) {
    case 'admin': return 'primary'
    case 'user': return 'success'
    default: return 'neutral'
  }
}

const getActionColor = (action?: string): 'success' | 'warning' | 'error' | 'primary' | 'neutral' => {
  switch (action) {
    case 'create': return 'success'
    case 'update': return 'warning'
    case 'delete':
    case 'clear':
    case 'cleanup':
    case 'loginFailed': return 'error'
    case 'login':
    case 'logout': return 'primary'
    default: return 'neutral'
  }
}

const viewOperation = (log: any) => {
  selected.value = log
  isDetailsOpen.value = true
}

const pruneLogs = async () => {
  const isConfirmed = await confirm({
    title: t('admin.operationLogs.cleanup.confirmTitle'),
    description: t('admin.operationLogs.cleanup.confirmMessage', { days: cleanupDays.value }),
  })

  if (!isConfirmed) return

  isPruning.value = true
  try {
    const result: any = await $fetch('/api/admin/operation-logs/cleanup', {
      method: 'POST',
      body: { days: cleanupDays.value },
    })
    toast.add({
      title: t('admin.operationLogs.cleanup.success', { count: result.deletedCount }),
      color: 'success',
    })
    page.value = 1
    refresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.operationLogs.cleanup.error'),
      description: e.data?.message,
      color: 'error',
    })
  } finally {
    isPruning.value = false
  }
}
</script>
