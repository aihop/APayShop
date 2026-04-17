<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">System Logs</h1>
        <p class="text-gray-400 mt-2 text-sm">View and manage application event logs</p>
      </div>
      <UButton
        color="red"
        variant="outline"
        icon="ph:trash-bold"
        @click="clearAllLogs"
        :loading="isClearing"
      >Clear All Logs</UButton>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="logs"
          :columns="columns"
          :loading="pending"
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
            <span class="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-1 rounded">
              {{ row.original.source || 'system' }}
            </span>
          </template>

          <template #message-cell="{ row }">
            <div class="flex flex-col gap-1 max-w-lg">
              <span class="text-sm font-medium text-white line-clamp-2">{{ row.original.message }}</span>
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
            <span class="text-gray-400 text-sm whitespace-nowrap">
              {{ new Date(row.original.createdAt).toLocaleString() }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                v-if="row.original.details"
                color="gray"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                @click="viewDetails(row.original)"
              />
              <UButton
                color="red"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                @click="deleteLog(row.original.id)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-800/50 flex items-center justify-between shrink-0 bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-400">
          Showing {{ logs.length > 0 ? (page - 1) * pageSize + 1 : 0 }} to
          {{ Math.min(page * pageSize, totalItems) }} of {{ totalItems }} entries
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

    <!-- Details Modal -->
    <UModal v-model:open="isDetailsOpen">
      <template #content>
        <UCard
          class="bg-[#121214] ring-1 ring-gray-800"
          :ui="{ divide: 'divide-gray-800' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                <UIcon
                  name="ph:terminal-window"
                  class="w-5 h-5 text-gray-400"
                />
                Log Details
              </h3>
              <UButton
                color="gray"
                variant="ghost"
                icon="ph:x"
                class="-my-1"
                @click="isDetailsOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Message</div>
              <div class="text-white text-sm bg-gray-900 p-3 rounded-lg border border-gray-800">
                {{ selectedLog?.message }}
              </div>
            </div>

            <div>
              <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Technical Details</div>
              <div class="bg-black p-4 rounded-lg border border-gray-800 overflow-y-auto max-h-96">
                <pre class="text-xs font-mono text-gray-300 whitespace-pre-wrap">{{ formatDetails(selectedLog?.details) }}</pre>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Source</div>
                <div class="text-sm text-gray-300">{{ selectedLog?.source || 'system' }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Time</div>
                <div class="text-sm text-gray-300">{{ selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : '' }}</div>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

definePageMeta({ title: 'System Logs' })

const toast = useToast()

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'source', header: 'Source' },
  { accessorKey: 'message', header: 'Message' },
  { accessorKey: 'createdAt', header: 'Timestamp' },
  {
    accessorKey: 'actions',
    header: 'Actions',
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
      },
    },
  },
]

const { page, pageSize, onPageChange } = usePagination(15)
const isClearing = ref(false)
const isDetailsOpen = ref(false)
const selectedLog = ref<any>(null)

const { data, pending, refresh } = await useFetch<any>('/api/admin/logs', {
  query: {
    page,
    pageSize,
  },
  watch: [page],
})

const logs = computed(() => data.value?.logs || [])
const totalItems = computed(() => data.value?.total || 0)

const getLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'error':
      return 'red'
    case 'warn':
      return 'warning'
    case 'debug':
      return 'gray'
    case 'info':
    default:
      return 'primary'
  }
}

const formatDetails = (details: string | null) => {
  if (!details) return ''
  try {
    // Try to format if it's a JSON string
    return JSON.stringify(JSON.parse(details), null, 2)
  } catch (e) {
    // If not JSON, return as is
    return details
  }
}

const viewDetails = (log: any) => {
  selectedLog.value = log
  isDetailsOpen.value = true
}

const deleteLog = async (id: number) => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete Log',
    description: 'Are you sure you want to delete this log entry?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/logs/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Success',
      description: 'Log deleted successfully',
      color: 'success',
    })
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete log',
      color: 'error',
    })
  }
}

const clearAllLogs = async () => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Clear All Logs',
    description:
      'WARNING: Are you sure you want to permanently delete ALL system logs? This action cannot be undone.',
  })

  if (!isConfirmed) return

  isClearing.value = true
  try {
    await $fetch('/api/admin/logs/clear', {
      method: 'DELETE',
    })
    toast.add({
      title: 'Success',
      description: 'All logs have been cleared',
      color: 'success',
    })
    page.value = 1
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to clear logs',
      color: 'error',
    })
  } finally {
    isClearing.value = false
  }
}
</script>