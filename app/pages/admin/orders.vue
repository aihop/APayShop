<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.orders.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.orders.subtitle') }}</p>
      </div>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 shadow-[0_0_30px_rgba(0,0,0,0.3)] rounded-2xl flex flex-col flex-1 min-h-0">

      <UTable
        :columns="columns"
        :data="paginatedOrders"
        :loading="pending"
        sticky
      >
        <template #id-cell="{ row }">
          <div class="flex flex-col min-w-[150px]">
            <span
              class="text-sm font-mono text-white cursor-pointer hover:text-primary-400"
              :title="row.original.id"
              @click="copyToClipboard(row.original.id, 'Order ID')"
            >
              {{ row.original.id }}
            </span>
            <div
              v-if="row.original.payMethod || row.original.tradeNo"
              class="flex items-center gap-2 mt-0.5 text-xs text-gray-500"
            >
              <span
                v-if="row.original.payMethod"
                class="capitalize font-medium text-gray-400"
              >
                {{ row.original.payMethod }}
              </span>
              <template v-if="row.original.tradeNo">
                <span
                  v-if="row.original.payMethod"
                  class="text-gray-700"
                >•</span>
                <UIcon
                  name="ph:receipt"
                  class="w-3.5 h-3.5 shrink-0"
                />
                <span
                  class="font-mono truncate cursor-pointer hover:text-primary-400"
                  :title="'Trade No: ' + row.original.tradeNo"
                  @click="copyToClipboard(row.original.tradeNo, 'Trade No')"
                >
                  {{ row.original.tradeNo }}
                </span>
              </template>
            </div>
          </div>
        </template>

        <template #productName-cell="{ row }">
          <div class="flex items-center gap-3">
            <!-- Product Image (if available) -->
            <div class="w-10 h-10 rounded overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center border border-gray-700">
              <img
                v-if="row.original.productImage"
                :src="row.original.productImage"
                :alt="row.original.productName"
                class="w-full h-full object-cover"
              />
              <UIcon
                v-else
                name="ph:package"
                class="text-gray-500 w-5 h-5"
              />
            </div>

            <!-- Product Details -->
            <div class="flex flex-col min-w-0">
              <NuxtLink
                v-if="row.original.productId"
                :to="`/products/${row.original.productSlug || row.original.productId}`"
                target="_blank"
                class="text-sm font-medium text-white hover:text-primary-400 hover:underline truncate"
                :title="row.original.productName"
              >
                {{ row.original.productName }}
              </NuxtLink>
              <span
                v-else
                class="text-sm font-medium text-white truncate"
              >{{ row.original.productName || 'Unknown' }}</span>

              <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span
                  v-if="row.original.productType"
                  class="capitalize px-1.5 py-0.5 bg-gray-800 rounded text-[10px]"
                >{{ row.original.productType }}</span>
                <span class="text-emerald-400 font-medium">${{ Number(row.original.amount || 0).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </template>
        <template #user-cell="{ row }">
          <div class="flex flex-col">
            <!-- If registered user -->
            <template v-if="row.original.userEmail">
              <span class="text-sm font-medium text-white flex items-center gap-1.5">
                <UIcon
                  name="ph:user-circle-fill"
                  class="w-4 h-4 text-primary-500"
                />
                {{ row.original.userNickname || String(row.original.userEmail || '').split('@')[0] }}
              </span>
              <span class="text-xs text-gray-500 mt-0.5">{{ row.original.userEmail }}</span>
            </template>
            <!-- If anonymous visitor -->
            <template v-else>
              <span class="text-sm text-gray-300">{{ row.original.contactEmail }}</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <UIcon
                  name="ph:ghost"
                  class="w-3.5 h-3.5 text-gray-500"
                />
                <span
                  v-if="row.original.visitorId"
                  class="text-xs text-gray-500 font-mono cursor-pointer hover:text-primary-400 transition-colors"
                  :title="String(row.original.visitorId)"
                  @click="copyVisitorId(String(row.original.visitorId))"
                >
                  {{ String(row.original.visitorId).substring(0, 8) }}...
                </span>
                <span
                  v-else
                  class="text-xs text-gray-600"
                >No Visitor ID</span>
              </div>
            </template>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-4">
            <div class="flex flex-col items-end">
              <span class="text-xs text-gray-500 mb-1">{{ formatRelativeTime(String(row.original.createdAt || ''), t) }}</span>
              <div class="flex gap-1">
                <UBadge
                  :color="getPayStatusColor(String(row.original.payStatus || 'pending'))"
                  variant="subtle"
                  class="capitalize whitespace-nowrap text-[10px] px-1.5 py-0"
                  :title="`Payment: ${row.original.payStatus || 'pending'}`"
                >
                  {{ $t('admin.orders.pay_status_' + (row.original.payStatus || 'pending')) }}
                </UBadge>
                <UBadge
                  :color="getStatusColor(String(row.original.status || 'none'))"
                  variant="subtle"
                  class="capitalize whitespace-nowrap text-[10px] px-1.5 py-0"
                  :title="`Fulfillment: ${row.original.status || 'none'}`"
                >
                  {{ $t('admin.orders.status_' + (row.original.status || 'none')) }}
                </UBadge>
              </div>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:eye"
              @click="viewDetails(row.original)"
            />
          </div>
        </template>
      </UTable>

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
    <!-- Order Details Modal -->
    <FullScreenModal
      v-model="isModalOpen"
      maxWidth="sm:max-w-3xl"
      title="Order Details"
    >
      <div
        v-if="selectedOrder"
        class="space-y-6"
      >
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-400">Order ID</p>
            <p class="text-white font-mono">{{ selectedOrder.id }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-400">Payment Status</p>
            <UBadge
              :color="getPayStatusColor(selectedOrder.payStatus)"
              variant="subtle"
              class="capitalize"
            >
              {{ $t('admin.orders.pay_status_' + (selectedOrder.payStatus || 'pending')) }}
            </UBadge>
          </div>
          <div>
            <p class="text-sm text-gray-400">Fulfillment Status</p>
            <UBadge
              :color="getStatusColor(selectedOrder.status)"
              variant="subtle"
              class="capitalize"
            >
              {{ $t('admin.orders.status_' + (selectedOrder.status || 'none')) }}
            </UBadge>
          </div>
          <div>
            <p class="text-sm text-gray-400">Contact Email</p>
            <p class="text-white">{{ selectedOrder.contactEmail }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-400">Amount</p>
            <p class="text-white">${{ Number(selectedOrder.amount).toFixed(2) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-400">Payment Method</p>
            <p class="text-white">{{ selectedOrder.payMethod || 'N/A' }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-400">Trade No</p>
            <p class="text-white font-mono">{{ selectedOrder.tradeNo || 'N/A' }}</p>
          </div>
        </div>

        <div
          v-if="selectedOrder.metaData"
          class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
        >
          <h3 class="text-white font-medium mb-2">Order Meta Data (User Input)</h3>
          <pre class="text-xs text-gray-300 overflow-auto whitespace-pre-wrap">{{ formatMetaData(selectedOrder.metaData) }}</pre>
        </div>

        <div class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]">
          <h3 class="text-white font-medium mb-4">Fulfillment & Status</h3>
          <div class="space-y-4">
            <UFormField label="Update Fulfillment Status">
              <USelect
                v-model="selectedOrder.status"
                class="min-w-[150px]"
                :items="['none', 'processing', 'active', 'delivered', 'expired', 'failed', 'completed']"
              />
            </UFormField>
            <UFormField label="Update Payment Status">
              <USelect
                v-model="selectedOrder.payStatus"
                class="min-w-[150px]"
                :items="['pending', 'paid', 'failed', 'refunded']"
              />
            </UFormField>
            <UFormField label="Delivery Info (Note/Link/Key)">
              <UTextarea
                v-model="selectedOrder.deliveryInfo"
                :rows="3"
                class="text-white w-full"
              />
            </UFormField>
            <UButton
              color="primary"
              :loading="isSaving"
              @click="saveOrder"
            >Update Order</UButton>
          </div>
        </div>
      </div>
    </FullScreenModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatRelativeTime } from '~/utils/formatTime'

const { t } = useI18n()

definePageMeta({ title: 'Orders Management' })

const toast = useToast()

const columns = computed(() => [
  { accessorKey: 'id', header: t('admin.orders.id') },
  { accessorKey: 'productName', header: t('admin.dashboard.product') },
  { accessorKey: 'user', header: 'User' },
  {
    accessorKey: 'actions',
    header: t('admin.common.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 z-30 bg-[#121214]/95 backdrop-blur-md before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
      },
    },
  },
])

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: ordersData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/orders', {
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

const orders = computed(() => ordersData.value?.data || [])
const totalItems = computed(() => ordersData.value?.total || 0)

const isModalOpen = ref(false)
const selectedOrder = ref<any>(null)
const isSaving = ref(false)

const formatMetaData = (metaData: any) => {
  if (!metaData) return ''
  try {
    const obj = typeof metaData === 'string' ? JSON.parse(metaData) : metaData
    return JSON.stringify(obj, null, 2)
  } catch (e) {
    return String(metaData)
  }
}

const saveOrder = async () => {
  if (!selectedOrder.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/admin/orders/${selectedOrder.value.id}`, {
      method: 'PUT',
      body: {
        status: selectedOrder.value.status,
        deliveryInfo: selectedOrder.value.deliveryInfo,
      },
    })
    toast.add({
      title: 'Success',
      description: 'Order updated',
      color: 'success',
    })
    await refresh()
    isModalOpen.value = false
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to update order',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const paginatedOrders = computed(() => {
  // Now orders already contains just the current page's data from the server
  return orders.value
})

const getPayStatusColor = (payStatus: string): any => {
  switch (payStatus) {
    case 'pending':
      return 'neutral'
    case 'paid':
      return 'success'
    case 'failed':
      return 'error'
    case 'refunded':
      return 'info'
    default:
      return 'neutral'
  }
}

const getStatusColor = (status: string): any => {
  switch (status) {
    case 'processing':
    case 'active':
      return 'warning'
    case 'delivered':
    case 'completed':
      return 'success'
    case 'expired':
    case 'failed':
      return 'error'
    default:
      return 'neutral'
  }
}

const copyVisitorId = (id: string) => {
  if (!id) return
  navigator.clipboard.writeText(id)
  toast.add({
    title: 'Copied',
    description: 'Visitor ID copied to clipboard',
    color: 'success',
  })
}

const copyToClipboard = (text: string, label: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({
    title: 'Copied',
    description: `${label} copied to clipboard`,
    color: 'success',
  })
}

const viewDetails = (order: any) => {
  selectedOrder.value = { ...order }
  isModalOpen.value = true
}
</script>