<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.subscriptions.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.subscriptions.subtitle') }}</p>
      </div>
      <UInput
        v-model="searchQuery"
        icon="ph:magnifying-glass"
        :placeholder="$t('admin.subscriptions.search')"
        class="w-64"
      />
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedSubscriptions"
          :columns="columns"
          :loading="pending"
          class="min-w-full"
        >
          <template #gatewaySubId-cell="{ row }">
            <span class="text-xs text-purple-400 font-mono">
              {{ String(row.original.gatewaySubId || row.original.id || '').substring(0, 16) }}...
            </span>
          </template>

          <template #productName-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-white">{{ row.original.productName || 'Unknown Product' }}</span>
              <span
                v-if="row.original.payMethod"
                class="text-xs text-gray-500 capitalize"
              >
                via {{ row.original.payMethod }}
              </span>
            </div>
          </template>

          <template #customer-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm text-gray-300">{{ row.original.userEmail || 'Unknown User' }}</span>
              <span
                v-if="row.original.userNickname"
                class="text-xs text-gray-500"
              >
                {{ row.original.userNickname }}
              </span>
            </div>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.status === 'active' ? 'success' : (row.original.status === 'past_due' ? 'warning' : 'error')"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ row.original.status }}
            </UBadge>
          </template>

          <template #amount-cell="{ row }">
            <span class="text-sm font-medium text-white">
              {{ row.original.amount }} {{ row.original.currency }}
            </span>
          </template>

          <template #interval-cell="{ row }">
            <span class="text-sm text-gray-400 capitalize">
              {{ row.original.intervalCount || 1 }} {{ row.original.interval || 'month' }}
            </span>
          </template>

          <template #dates-cell="{ row }">
            <div class="flex flex-col text-xs text-gray-400 gap-1">
              <span>Start: {{ new Date(row.original.currentPeriodStart || row.original.createdAt).toLocaleDateString() }}</span>
              <span v-if="row.original.currentPeriodEnd">
                Exp: {{ new Date(row.original.currentPeriodEnd).toLocaleDateString() }}
              </span>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-800/50 flex items-center justify-between shrink-0 bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-400">
          Showing {{ Math.min((page - 1) * pageSize + 1, totalItems) }} to
          {{ Math.min(page * pageSize, totalItems) }} of {{ totalItems }} entries
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :page-count="pageSize"
          :max="5"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ title: 'Subscriptions Management' })

const { t } = useI18n()

const columns = [
  { accessorKey: 'orderId', header: t('admin.orders.orderId') },
  { accessorKey: 'productName', header: t('admin.common.product') },
  { accessorKey: 'interval', header: t('admin.common.interval') },
  { accessorKey: 'customer', header: t('admin.common.customer') },
  { accessorKey: 'amount', header: t('admin.common.amount') },
  { accessorKey: 'status', header: t('admin.common.status') },
  { accessorKey: 'dates', header: t('admin.common.time') },
]

const searchQuery = ref('')

// Fetch subscriptions
const { data: subscriptions, pending } = await useFetch<any[]>(
  '/api/admin/subscriptions',
  {
    default: () => [],
  }
)

// Search & Pagination
const page = ref(1)
const pageSize = 15

const filteredSubscriptions = computed(() => {
  if (!subscriptions.value) return []

  if (!searchQuery.value) return subscriptions.value

  const q = searchQuery.value.toLowerCase()
  return subscriptions.value.filter(
    (sub) =>
      sub.contactEmail?.toLowerCase().includes(q) ||
      sub.id?.toLowerCase().includes(q) ||
      sub.productName?.toLowerCase().includes(q)
  )
})

const totalItems = computed(() => filteredSubscriptions.value.length)

const paginatedSubscriptions = computed(() => {
  const start = (page.value - 1) * pageSize
  const end = start + pageSize
  return filteredSubscriptions.value.slice(start, end)
})

// Reset page when search changes
watch(searchQuery, () => {
  page.value = 1
})
</script>