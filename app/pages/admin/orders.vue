<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.orders.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.orders.subtitle') }}</p>
      </div>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

      <UTable
        :columns="columns"
        :data="paginatedOrders"
        :loading="pending"
        sticky
      >
        <template #id-cell="{ row }">
          <div class="flex flex-col min-w-[150px]">
            <span
              class="text-sm font-mono text-gray-900 dark:text-white cursor-pointer hover:text-primary-400"
              :title="row.original.id"
              @click="copyToClipboard(row.original.id, t('admin.orders.modal.order_id'))"
            >
              {{ row.original.id }}
            </span>
            <div
              v-if="row.original.payMethod || row.original.tradeNo"
              class="flex items-center gap-2 mt-0.5 text-xs text-gray-500"
            >
              <span
                v-if="row.original.payMethod"
                class="capitalize font-medium text-gray-500 dark:text-gray-400"
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
                  :title="$t('admin.orders.modal.trade_no') + ': ' + row.original.tradeNo"
                  @click="copyToClipboard(row.original.tradeNo, t('admin.orders.modal.trade_no'))"
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
            <div class="w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700">
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
                class="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-400 hover:underline truncate"
                :title="row.original.productName"
              >
                {{ row.original.productName }}
              </NuxtLink>
              <span
                v-else
                class="text-sm font-medium text-gray-900 dark:text-white truncate"
              >{{ row.original.productName || $t('admin.orders.unknown_product') }}</span>

              <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span
                  v-if="row.original.productType"
                  class="capitalize px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]"
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
              <span class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
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
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.original.contactEmail }}</span>
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
                >{{ $t('admin.orders.no_visitor_id') }}</span>
              </div>
            </template>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-4">
            <div class="flex flex-col items-end">
              <span class="text-xs text-gray-500 mb-1">{{ formatDateTime(row.original.createdAt) }}</span>
              <div class="flex gap-1">
                <UBadge
                  :color="getPayStatusColor(String(row.original.payStatus || 'pending'))"
                  variant="subtle"
                  class="capitalize whitespace-nowrap text-[10px] px-1.5 py-0"
                  :title="$t('admin.orders.payment_label') + ': ' + (row.original.payStatus || 'pending')"
                >
                  {{ $t('admin.orders.pay_status_' + (row.original.payStatus || 'pending')) }}
                </UBadge>
                <UBadge
                  :color="getStatusColor(String(row.original.status || 'none'))"
                  variant="subtle"
                  class="capitalize whitespace-nowrap text-[10px] px-1.5 py-0"
                  :title="$t('admin.orders.fulfillment_label') + ': ' + (row.original.status || 'none')"
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
      <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex justify-between items-center shrink-0 bg-white dark:bg-[#121214]">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          <span class="text-gray-900 dark:text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
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
      :title="$t('admin.orders.modal.title')"
    >
      <div
        v-if="selectedOrder"
        class="space-y-6"
      >
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.order_id') }}</p>
            <p class="text-gray-900 dark:text-white font-mono">{{ selectedOrder.id }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.payment_status') }}</p>
            <UBadge
              :color="getPayStatusColor(selectedOrder.payStatus)"
              variant="subtle"
              class="capitalize"
            >
              {{ $t('admin.orders.pay_status_' + (selectedOrder.payStatus || 'pending')) }}
            </UBadge>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.fulfillment_status') }}</p>
            <UBadge
              :color="getStatusColor(selectedOrder.status)"
              variant="subtle"
              class="capitalize"
            >
              {{ $t('admin.orders.status_' + (selectedOrder.status || 'none')) }}
            </UBadge>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.contact_email') }}</p>
            <p class="text-gray-900 dark:text-white">{{ selectedOrder.contactEmail }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.amount') }}</p>
            <p class="text-gray-900 dark:text-white">${{ Number(selectedOrder.amount).toFixed(2) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.payment_method') }}</p>
            <p class="text-gray-900 dark:text-white">{{ selectedOrder.payMethod || $t('admin.orders.na') }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.trade_no') }}</p>
            <p class="text-gray-900 dark:text-white font-mono">{{ selectedOrder.tradeNo || $t('admin.orders.na') }}</p>
          </div>
        </div>

        <div
          v-if="selectedOrder.metaData"
          class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1a1a1c]"
        >
          <h3 class="text-gray-900 dark:text-white font-medium mb-2">{{ $t('admin.orders.modal.meta_data') }}</h3>
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-auto whitespace-pre-wrap">{{ formatMetaData(selectedOrder.metaData) }}</pre>
        </div>

        <div class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1a1a1c]">
          <h3 class="text-gray-900 dark:text-white font-medium mb-3">{{ $t('admin.orders.modal.frontend_payment_title') }}</h3>
          <div class="space-y-3">
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 px-3 py-2">
              <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ $t('admin.orders.modal.payment_link') }}</p>
              <p class="text-xs font-mono text-gray-900 dark:text-white break-all">
                {{ getFrontendPaymentUrl(selectedOrder.id) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="primary"
                variant="soft"
                icon="ph:credit-card"
                :to="getFrontendPaymentPath(selectedOrder.id)"
                target="_blank"
              >
                {{ $t('admin.orders.modal.open_payment_page') }}
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                icon="ph:copy"
                @click="copyFrontendPaymentUrl(selectedOrder.id)"
              >
                {{ $t('admin.orders.modal.copy_payment_link') }}
              </UButton>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('admin.orders.modal.payment_page_hint') }}
            </p>
          </div>
        </div>

        <div class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1a1a1c]">
          <h3 class="text-gray-900 dark:text-white font-medium mb-4">{{ $t('admin.orders.modal.fulfillment_title') }}</h3>
          <div class="space-y-4">
            <UFormField :label="$t('admin.orders.modal.update_fulfillment')">
              <USelect
                v-model="selectedOrder.status"
                class="min-w-[150px]"
                :items="['none', 'processing', 'active', 'delivered', 'expired', 'failed', 'completed']"
              />
            </UFormField>
            <UFormField :label="$t('admin.orders.modal.update_payment')">
              <USelect
                v-model="selectedOrder.payStatus"
                class="min-w-[150px]"
                :items="['pending', 'paid', 'failed', 'refunded']"
              />
            </UFormField>
            <UFormField :label="$t('admin.orders.modal.delivery_info')">
              <UTextarea
                v-model="selectedOrder.deliveryInfo"
                :rows="3"
                class="text-gray-900 dark:text-white w-full"
              />
            </UFormField>
            <UButton
              color="primary"
              :loading="isSaving"
              @click="saveOrder"
            >{{ $t('admin.orders.modal.update_order') }}</UButton>
          </div>
        </div>
      </div>
    </FullScreenModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { definePageMeta, useToast, useFetch, useRouter, useI18n, useRequestURL } from '#imports'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()

definePageMeta({ title: 'Orders Management', layout: 'admin' })

const toast = useToast()
const requestUrl = useRequestURL()

const columns = computed(() => [
  { accessorKey: 'id', header: t('admin.orders.id') },
  { accessorKey: 'productName', header: t('admin.dashboard.product') },
  { accessorKey: 'user', header: t('admin.orders.user') },
  {
    accessorKey: 'actions',
    header: t('admin.common.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 z-30 bg-white/95 backdrop-blur-md dark:bg-[#121214]/95 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
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
const frontendOrigin = computed(() => requestUrl.origin.replace(/\/$/, ''))

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
        payStatus: selectedOrder.value.payStatus,
        deliveryInfo: selectedOrder.value.deliveryInfo,
      },
    })
    toast.add({
      title: t('admin.orders.toast.success'),
      description: t('admin.orders.toast.order_updated'),
      color: 'success',
    })
    await refresh()
    isModalOpen.value = false
  } catch (e: any) {
    toast.add({
      title: t('admin.orders.toast.error'),
      description: e.data?.message || t('admin.orders.toast.update_failed'),
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
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.visitor_id_copied'),
    color: 'success',
  })
}

const copyToClipboard = (text: string, label: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.copied_to_clipboard', { label }),
    color: 'success',
  })
}

const getFrontendPaymentPath = (orderId?: string) => `/payment/${orderId || ''}`

const getFrontendPaymentUrl = (orderId?: string) => `${frontendOrigin.value}${getFrontendPaymentPath(orderId)}`

const copyFrontendPaymentUrl = (orderId?: string) => {
  if (!orderId) return
  navigator.clipboard.writeText(getFrontendPaymentUrl(orderId))
  toast.add({
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.payment_link_copied'),
    color: 'success',
  })
}

const viewDetails = (order: any) => {
  selectedOrder.value = { ...order }
  isModalOpen.value = true
}
</script>
