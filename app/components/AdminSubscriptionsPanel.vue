<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Top toolbar -->
    <div class="mb-4 flex shrink-0 items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <UInput
          v-model="searchQuery"
          icon="ph:magnifying-glass"
          :placeholder="t('admin.subscriptions.search', '搜索订阅订单号、商品名或客户邮箱...')"
          class="w-80"
          size="sm"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          size="sm"
          :loading="pending"
          class="hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="() => refresh()"
        />
      </div>
      <div class="text-xs text-gray-500">
        共 {{ filteredSubscriptions.length }} 条订阅记录
      </div>
    </div>

    <!-- Subscriptions Table -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedSubscriptions"
          :columns="columns"
          :loading="pending"
          class="min-w-full"
          sticky
        >
          <template #orderId-cell="{ row }">
            <div class="flex flex-col min-w-[150px]">
              <span
                class="text-sm font-mono font-medium text-gray-900 dark:text-white cursor-pointer hover:text-primary-500 truncate"
                :title="row.original.orderId || row.original.id"
                @click="copyToClipboard(row.original.orderId || row.original.id, t('admin.orders.modal.order_id', '订阅号'))"
              >
                {{ row.original.orderId || row.original.id }}
              </span>
              <span
                v-if="row.original.gatewaySubId && row.original.gatewaySubId !== row.original.orderId"
                class="text-[11px] text-gray-400 font-mono truncate"
                :title="row.original.gatewaySubId"
              >
                {{ row.original.gatewaySubId }}
              </span>
            </div>
          </template>

          <template #productName-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ row.original.productName || 'Unknown Product' }}</span>
              <span
                v-if="row.original.payMethod"
                class="text-xs text-gray-400 capitalize"
              >
                渠道: {{ row.original.payMethod }}
              </span>
            </div>
          </template>

          <template #customer-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">{{ row.original.userEmail || row.original.contactEmail || '匿名客户' }}</span>
              <span
                v-if="row.original.userNickname"
                class="text-xs text-gray-400"
              >
                {{ row.original.userNickname }}
              </span>
            </div>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.status === 'active' ? 'success' : (row.original.status === 'past_due' ? 'warning' : 'neutral')"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ row.original.status }}
            </UBadge>
          </template>

          <template #amount-cell="{ row }">
            <span class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ row.original.amount }} {{ row.original.currency }}
            </span>
          </template>

          <template #interval-cell="{ row }">
            <span class="text-sm text-gray-500 capitalize">
              {{ row.original.intervalCount || 1 }} {{ row.original.interval || 'month' }}
            </span>
          </template>

          <template #dates-cell="{ row }">
            <div class="flex flex-col text-xs text-gray-400 gap-0.5">
              <span>起: {{ formatDate(row.original.currentPeriodStart || row.original.createdAt) }}</span>
              <span v-if="row.original.currentPeriodEnd">
                止: {{ formatDate(row.original.currentPeriodEnd) }}
              </span>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-3.5 border-t border-gray-200/80 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214]">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          共 {{ totalItems }} 条订阅记录
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageSize"
          :max="5"
          size="sm"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()
const toast = useToast()

const searchQuery = ref('')
const {
  page,
  pageSize,
  totalItems,
  onPageChange,
} = usePagination(10)

const { data: subData, pending, refresh } = await useFetch<any>('/api/admin/subscriptions')
const subscriptions = computed(() => subData.value?.data || [])

const filteredSubscriptions = computed(() => {
  if (!searchQuery.value) return subscriptions.value
  const q = searchQuery.value.toLowerCase()
  return subscriptions.value.filter((s: any) =>
    (s.orderId && s.orderId.toLowerCase().includes(q)) ||
    (s.gatewaySubId && s.gatewaySubId.toLowerCase().includes(q)) ||
    (s.productName && s.productName.toLowerCase().includes(q)) ||
    (s.userEmail && s.userEmail.toLowerCase().includes(q)) ||
    (s.contactEmail && s.contactEmail.toLowerCase().includes(q))
  )
})

watch(filteredSubscriptions, (newSubs) => {
  totalItems.value = newSubs.length
}, { immediate: true })

const paginatedSubscriptions = computed(() => {
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSubscriptions.value.slice(start, end)
})

const columns = computed(() => [
  { accessorKey: 'orderId', header: t('admin.subscriptions.orderId', '订阅单号') },
  { accessorKey: 'productName', header: t('admin.subscriptions.product', '订阅商品') },
  { accessorKey: 'customer', header: t('admin.subscriptions.customer', '客户') },
  { accessorKey: 'status', header: t('admin.subscriptions.status', '状态') },
  { accessorKey: 'amount', header: t('admin.subscriptions.amount', '周期金额') },
  { accessorKey: 'interval', header: t('admin.subscriptions.interval', '计费周期') },
  { accessorKey: 'dates', header: t('admin.subscriptions.period', '有效期') },
])

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text)
  toast.add({
    title: t('admin.common.copied', '已复制到剪贴板'),
    description: `${label}: ${text}`,
    color: 'success',
  })
}
</script>
