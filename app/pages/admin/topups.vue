<template>
  <div class="flex h-[calc(100vh-10rem)] flex-col">
    <div class="mb-8 flex shrink-0 flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ t('admin.topups.title') }}</h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('admin.topups.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <USelect v-model="status" :items="statusOptions" value-key="value" class="w-44" />
        <UButton icon="ph:arrows-clockwise" :loading="retrying" @click="retryIncomplete">
          {{ t('admin.topups.safeRetry') }}
        </UButton>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-800/50 dark:bg-[#121214]">
      <div class="flex-1 overflow-auto">
        <UTable :columns="columns" :data="rows" :loading="pending" sticky>
          <template #orderId-cell="{ row }">
            <span class="font-mono text-xs text-gray-900 dark:text-white">{{ row.original.orderId }}</span>
          </template>
          <template #user-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm text-gray-900 dark:text-white">{{ row.original.userEmail || `#${row.original.userId}` }}</span>
              <span class="text-xs text-gray-500">#{{ row.original.userId }}</span>
            </div>
          </template>
          <template #payment-cell="{ row }">
            <span class="text-sm">{{ formatAmount(row.original.paymentAmount, row.original.paymentCurrency) }}</span>
          </template>
          <template #credit-cell="{ row }">
            <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">{{ formatAmount(row.original.creditAmount, row.original.creditCurrency) }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="statusColor(row.original.status)" variant="subtle">{{ statusLabel(row.original.status) }}</UBadge>
          </template>
          <template #error-cell="{ row }">
            <span class="block max-w-72 truncate text-xs text-gray-500" :title="row.original.lastError || ''">
              {{ row.original.lastError || t('admin.topups.noError') }}
            </span>
          </template>
          <template #time-cell="{ row }">
            <span class="whitespace-nowrap text-xs text-gray-500">{{ formatDateTime(row.original.createdAt) }}</span>
          </template>
        </UTable>
      </div>

      <div class="flex shrink-0 items-center justify-between border-t border-gray-200 p-4 dark:border-gray-800/50">
        <span class="text-sm text-gray-500">{{ total }} {{ t('admin.common.results') }}</span>
        <UPagination v-model="page" :total="total" :items-per-page="pageSize" :max="7" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

definePageMeta({ title: 'Top-up Records', layout: 'admin' })

const { t } = useI18n()
const toast = useToast()
const { formatDateTime } = useFormatTime()
const page = ref(1)
const pageSize = 20
const status = ref('all')
const retrying = ref(false)

const statusKeys = ['pending', 'payment_failed', 'paid', 'crediting', 'credited', 'credit_failed', 'review_required', 'refunding', 'refunded']
const statusOptions = computed(() => [
  { label: t('admin.topups.allStatuses'), value: 'all' },
  ...statusKeys.map(value => ({ label: statusLabel(value), value })),
])
const query = computed(() => ({
  page: page.value,
  pageSize,
  ...(status.value !== 'all' ? { status: status.value } : {}),
}))
const { data, pending, refresh } = await useFetch<any>('/api/admin/topups', { query })
const rows = computed(() => data.value?.data?.list || [])
const total = computed(() => Number(data.value?.data?.total || 0))

const columns = computed(() => [
  { accessorKey: 'orderId', header: t('admin.topups.orderId') },
  { accessorKey: 'user', header: t('admin.topups.user') },
  { accessorKey: 'payment', header: t('admin.topups.payment') },
  { accessorKey: 'credit', header: t('admin.topups.credit') },
  { accessorKey: 'balanceType', header: t('admin.topups.balanceType') },
  { accessorKey: 'status', header: t('admin.topups.status') },
  { accessorKey: 'retryCount', header: t('admin.topups.retryCount') },
  { accessorKey: 'error', header: t('admin.topups.error') },
  { accessorKey: 'time', header: t('admin.topups.time') },
])

const statusLabel = (value: string) => ({
  pending: t('admin.topups.statusPending'),
  payment_failed: t('admin.topups.statusPaymentFailed'),
  paid: t('admin.topups.statusPaid'),
  crediting: t('admin.topups.statusCrediting'),
  credited: t('admin.topups.statusCredited'),
  credit_failed: t('admin.topups.statusCreditFailed'),
  review_required: t('admin.topups.statusReviewRequired'),
  refunding: t('admin.topups.statusRefunding'),
  refunded: t('admin.topups.statusRefunded'),
}[value] || value)
const statusColor = (value: string) => {
  if (value === 'credited') return 'success'
  if (['pending', 'paid', 'crediting', 'refunding'].includes(value)) return 'warning'
  if (value === 'refunded') return 'neutral'
  return 'error'
}
const formatAmount = (amount: unknown, currency: unknown) => `${Number(amount || 0).toFixed(2)} ${String(currency || '')}`

const retryIncomplete = async () => {
  retrying.value = true
  try {
    const response: any = await $fetch('/api/admin/topups/retry', { method: 'POST', body: { limit: 50 } })
    toast.add({ title: t('admin.topups.retryDone', response.data || {}), color: 'success' })
    await refresh()
  } catch (error: any) {
    toast.add({ title: t('admin.topups.retryFailed'), description: String(error?.data?.message || error?.message || ''), color: 'error' })
  } finally {
    retrying.value = false
  }
}

watch(status, () => { page.value = 1 })
</script>
