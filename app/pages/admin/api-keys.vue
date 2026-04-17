<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.apiKeys.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.apiKeys.subtitle') }}</p>
      </div>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :columns="columns"
          :data="paginatedKeys"
          :loading="pending"
          class="min-w-full"
        >
          <template #keyString-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono text-gray-300">{{ row.original.keyString.substring(0, 8) }}...</span>
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:copy"
                size="xs"
                @click="copyKey(row.original.keyString)"
              />
            </div>
          </template>

          <template #quota-cell="{ row }">
            <div class="flex flex-col gap-1">
              <span class="text-sm text-gray-300">{{ row.original.quotaUsed }} / {{ row.original.quotaLimit }}</span>
              <div class="w-full bg-gray-800 rounded-full h-1.5 max-w-[100px]">
                <div
                  class="bg-purple-500 h-1.5 rounded-full"
                  :style="{ width: `${Math.min(100, (row.original.quotaUsed / row.original.quotaLimit) * 100)}%` }"
                ></div>
              </div>
            </div>
          </template>

          <template #isActive-cell="{ row }">
            <UBadge
              :color="row.original.isActive ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ row.original.isActive ? 'Active' : 'Disabled' }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-gray-400">{{ new Date(String(row.original.createdAt || '')).toLocaleDateString() }}</span>
          </template>
        </UTable>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-800/50 flex justify-between items-center shrink-0 bg-[#121214]">
        <div class="text-sm text-gray-400">
          <span class="text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :page-count="pageCount"
          :total="totalItems"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

definePageMeta({ title: 'API Keys Management' })

const toast = useToast()
const { t } = useI18n()

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'keyString', header: t('admin.apiKeys.keyString') },
  { accessorKey: 'userEmail', header: t('admin.common.user') },
  { accessorKey: 'productName', header: t('admin.common.product') },
  { accessorKey: 'orderId', header: t('admin.orders.orderId') },
  { accessorKey: 'quotaLimit', header: t('admin.apiKeys.quotaLimit') },
  { accessorKey: 'quotaUsed', header: t('admin.apiKeys.quotaUsed') },
  { accessorKey: 'isActive', header: t('admin.common.status') },
  { accessorKey: 'createdAt', header: t('admin.common.createdAt') },
]

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: keysData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/api-keys', {
  query: {
    page,
    pageSize: pageCount,
  },
  watch: [page],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const paginatedKeys = computed(() => {
  const keys = keysData.value || []
  const start = (page.value - 1) * pageCount
  const end = start + pageCount
  return keys.slice(start, end)
})

const keys = computed(() => keysData.value?.data || [])
const totalItems = computed(() => keysData.value?.total || 0)

const copyKey = (key: string) => {
  navigator.clipboard.writeText(key)
  toast.add({
    title: 'Copied',
    description: 'API Key copied to clipboard',
    color: 'success',
  })
}
</script>