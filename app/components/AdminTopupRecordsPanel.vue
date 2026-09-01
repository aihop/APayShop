<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- 充值筛选栏 -->
    <div class="mb-4 flex shrink-0 items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">状态筛选：</span>
        <USelect v-model="status" :items="statusOptions" value-key="value" class="w-44" size="sm" />
      </div>
      <div class="flex items-center gap-2.5">
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          size="sm"
          :loading="pending"
          class="hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="() => refresh()"
        />
        <UButton
          color="primary"
          icon="ph:arrow-counter-clockwise-bold"
          size="sm"
          :loading="retrying"
          class="shadow-xs font-medium"
          @click="retryIncomplete"
        >
          {{ t('admin.topups.safeRetry', '补单重试') }}
        </UButton>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-800/50 dark:bg-[#121214]">
      <div class="flex-1 overflow-auto">
        <UTable :columns="columns" :data="rows" :loading="pending" sticky>
          <template #orderId-cell="{ row }">
            <span class="font-mono text-xs text-gray-900 dark:text-white font-medium">{{ row.original.orderId }}</span>
          </template>
          <template #user-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ row.original.userEmail || `#${row.original.userId}` }}</span>
              <span class="text-xs text-gray-400">用户 ID: #{{ row.original.userId }}</span>
            </div>
          </template>
          <template #payment-cell="{ row }">
            <span class="text-sm font-medium">{{ formatAmount(row.original.paymentAmount, row.original.paymentCurrency) }}</span>
          </template>
          <template #credit-cell="{ row }">
            <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{{ formatAmount(row.original.creditAmount, row.original.creditCurrency) }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="statusColor(row.original.status)" variant="subtle" size="sm">{{ statusLabel(row.original.status) }}</UBadge>
          </template>
          <template #error-cell="{ row }">
            <span class="block max-w-72 truncate text-xs text-gray-500" :title="row.original.lastError || ''">
              {{ row.original.lastError || t('admin.topups.noError', '正常') }}
            </span>
          </template>
          <template #time-cell="{ row }">
            <span class="whitespace-nowrap text-xs text-gray-500">{{ formatDateTime(row.original.createdAt) }}</span>
          </template>
        </UTable>
      </div>

      <div class="flex shrink-0 items-center justify-between border-t border-gray-200/80 p-3.5 dark:border-gray-800/50">
        <span class="text-xs text-gray-500">共 {{ total }} 条充值记录</span>
        <UPagination v-model="page" :total="total" :items-per-page="pageSize" :max="7" size="sm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()
const toast = useToast()
const { formatDateTime } = useFormatTime()
const page = ref(1)
const pageSize = 20
const status = ref('all')
const retrying = ref(false)

const statusKeys = ['pending', 'payment_failed', 'paid', 'crediting', 'credited', 'credit_failed', 'review_required', 'refunding', 'refunded']
const statusOptions = computed(() => [
  { label: t('admin.topups.allStatuses', '全部状态'), value: 'all' },
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
  { accessorKey: 'orderId', header: t('admin.topups.orderId', '充值单号') },
  { accessorKey: 'user', header: t('admin.topups.user', '充值客户') },
  { accessorKey: 'payment', header: t('admin.topups.payment', '支付金额') },
  { accessorKey: 'credit', header: t('admin.topups.credit', '到账算力/额度') },
  { accessorKey: 'balanceType', header: t('admin.topups.balanceType', '账户类型') },
  { accessorKey: 'status', header: t('admin.topups.status', '充值状态') },
  { accessorKey: 'retryCount', header: t('admin.topups.retryCount', '重试次数') },
  { accessorKey: 'error', header: t('admin.topups.error', '错误说明') },
  { accessorKey: 'time', header: t('admin.topups.time', '充值时间') },
])

const statusLabel = (value: string) => ({
  pending: t('admin.topups.statusPending', '待支付'),
  payment_failed: t('admin.topups.statusPaymentFailed', '支付失败'),
  paid: t('admin.topups.statusPaid', '已付款待充值'),
  crediting: t('admin.topups.statusCrediting', '充值入账中'),
  credited: t('admin.topups.statusCredited', '充值成功'),
  credit_failed: t('admin.topups.statusCreditFailed', '入账失败'),
  review_required: t('admin.topups.statusReviewRequired', '待人工审核'),
  refunding: t('admin.topups.statusRefunding', '退款中'),
  refunded: t('admin.topups.statusRefunded', '已退款'),
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
    toast.add({ title: t('admin.topups.retryDone', '已触发重试'), description: JSON.stringify(response.data || {}), color: 'success' })
    await refresh()
  } catch (error: any) {
    toast.add({ title: t('admin.topups.retryFailed', '重试失败'), description: String(error?.data?.message || error?.message || ''), color: 'error' })
  } finally {
    retrying.value = false
  }
}

watch(status, () => { page.value = 1 })
</script>
