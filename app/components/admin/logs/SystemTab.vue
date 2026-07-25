<template>
  <!-- The page owns the header layout; each tab teleports its own actions in so
       it stays self-contained. `defer` lets the target mount first. -->
  <Teleport to="#logs-header-actions" defer>
    <UButton
      v-if="hasAdminPerm('logs:edit')"
      color="error"
      variant="outline"
      icon="ph:trash-bold"
      :loading="isClearing"
      @click="clearAllLogs"
    >{{ $t('admin.logs.page.clear_all') }}</UButton>
  </Teleport>

  <AdminLogsTableCard
    :page="page"
    :page-size="pageSize"
    :total="totalItems"
    :row-count="logs.length"
    @update:page="(val) => onPageChange(val, () => refresh())"
  >
    <UTable :data="logs" :columns="columns" :loading="pending" sticky>
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
            v-if="hasAdminPerm('logs:edit')"
            color="error"
            variant="ghost"
            icon="ph:trash"
            size="sm"
            @click="deleteLog(row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </AdminLogsTableCard>

  <UModal v-model:open="isDetailsOpen">
    <template #content>
      <UCard class="bg-white dark:bg-[#121214] ring-1 ring-gray-200 dark:ring-gray-800">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="ph:terminal-window" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              {{ $t('admin.logs.detail.title') }}
            </h3>
            <UButton color="neutral" variant="ghost" icon="ph:x" class="-my-1" @click="isDetailsOpen = false" />
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

<script setup lang="ts">
import { ref } from 'vue'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const { getLevelColor, formatDetails } = useLogFormatters()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const toast = useToast()
const { confirm } = useConfirm()

const columns = [
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

const { page, pageSize, onPageChange } = usePagination(15)
const isClearing = ref(false)
const isDetailsOpen = ref(false)
const selectedLog = ref<Record<string, any> | null>(null)

// Lazy: this tab only fetches when it is actually mounted, so opening the page
// no longer fires all three log queries at once.
const { data, pending, refresh } = useFetch<any>('/api/admin/logs', {
  query: { page, pageSize },
  watch: [page],
  lazy: true,
})

const logs = computed<any[]>(() => data.value?.logs || [])
const totalItems = computed(() => data.value?.total || 0)

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
    await $fetch(`/api/admin/logs/${id}`, { method: 'DELETE' })
    toast.add({
      title: t('admin.logs.toast.success'),
      description: t('admin.logs.toast.deleted'),
      color: 'success',
    })
    refresh()
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
    await $fetch('/api/admin/logs/clear', { method: 'DELETE' })
    toast.add({
      title: t('admin.logs.toast.success'),
      description: t('admin.logs.toast.cleared'),
      color: 'success',
    })
    page.value = 1
    refresh()
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
</script>
