<template>
  <div class="min-h-screen bg-gray-50 dark:bg-[#050505] pt-32 pb-20 px-6 transition-colors">
    <div class="max-w-4xl mx-auto">

      <!-- Back Navigation -->
      <NuxtLink
        :to="localePath('/user/orders')"
        class="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-8"
      >
        <UIcon
          name="ph:arrow-left"
          class="w-4 h-4"
        />
        {{ $t('site.payment.backToOrders') }}
      </NuxtLink>

      <div
        v-if="pending"
        class="animate-pulse space-y-6"
      >
        <div class="h-32 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none"></div>
        <div class="h-64 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none"></div>
      </div>

      <div
        v-else-if="order"
        class="space-y-6"
      >
        <!-- Header Card -->
        <div class="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-sm dark:shadow-none">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('site.payment.orderTitle', { orderId: order.id }) }}</h1>
              <p class="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <UIcon
                  name="ph:calendar-blank"
                  class="w-4 h-4"
                />
                {{ formatDateTime(order.createdAt) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-emerald-400">{{ formatCurrencyAmount(order.amount, order.currency) }}</span>
              <div class="flex gap-2">
                <UBadge
                  v-if="order.payStatus === 'paid' || order.payStatus === 'delivered'"
                  color="success"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:check-circle-fill"
                    class="w-4 h-4 mr-1"
                  />
                  {{ $t('site.payment.paid') }}
                </UBadge>
                <UBadge
                  v-else-if="order.payStatus === 'pending'"
                  color="warning"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:clock-fill"
                    class="w-4 h-4 mr-1"
                  />
                  {{ $t('site.payment.pendingPayment') }}
                </UBadge>
                <UBadge
                  v-else
                  color="error"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:x-circle-fill"
                    class="w-4 h-4 mr-1"
                  />
                  {{ payStatusLabel(order.payStatus) }}
                </UBadge>

                <UBadge
                  color="primary"
                  variant="soft"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:package"
                    class="w-4 h-4 mr-1"
                  />
                  {{ orderStatusLabel(order.status) }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Product Summary -->
          <div class="flex flex-col md:flex-row items-center gap-6 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
            <div class="w-full md:w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden shrink-0">
              <img
                v-if="order.productImageUrl"
                :src="order.productImageUrl"
                :alt="order.productName"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-700"
              >
                <UIcon
                  name="ph:package"
                  class="w-8 h-8"
                />
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-bold">{{ productTypeLabel(order.productType) }}</span>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ order.productName }}</h3>
              </div>
              <p class="text-gray-500 dark:text-gray-400 text-sm mb-3">{{ $t('site.payment.successTips') }}</p>
              <UButton
                v-if="order.productSlug"
                :to="localePath(`/products/${order.productSlug}`)"
                target="_blank"
                variant="ghost"
                color="neutral"
                size="sm"
                class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {{ $t('site.payment.viewProductPage') }}
                <UIcon
                  name="ph:arrow-square-out"
                  class="w-4 h-4 ml-1"
                />
              </UButton>
            </div>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Payment Info -->
          <div class="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none">
            <div class="flex items-center gap-2 text-gray-900 dark:text-white font-bold mb-6">
              <UIcon
                name="ph:credit-card"
                class="w-5 h-5 text-purple-400"
              />
              <h3>{{ $t('site.payment.PaymentDetails') }}</h3>
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                <span class="text-gray-500 dark:text-gray-400">{{ $t('site.payment.payMethod') }}</span>
                <span class="text-gray-900 dark:text-white font-medium capitalize">{{ order.payMethod || $t('site.payment.notAvailable') }}</span>
              </div>
              <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                <span class="text-gray-500 dark:text-gray-400">{{ $t('site.payment.tradeNo') }}</span>
                <span class="text-gray-900 dark:text-white font-mono text-sm">{{ order.tradeNo || $t('site.payment.pending') }}</span>
              </div>
              <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                <span class="text-gray-500 dark:text-gray-400">{{ $t('site.payment.contactEmail') }}</span>
                <span class="text-gray-900 dark:text-white">{{ order.contactEmail || $t('site.payment.notAvailable') }}</span>
              </div>
              <div class="flex justify-between items-center py-3">
                <span class="text-gray-500 dark:text-gray-400">{{ $t('site.payment.paidAt') }}</span>
                <span class="text-gray-900 dark:text-white">{{ order.paidAt ? formatDateTime(order.paidAt) : $t('site.payment.notAvailable') }}</span>
              </div>
            </div>
          </div>

          <!-- Fulfillment Info -->
          <div class="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none">
            <div class="flex items-center gap-2 text-gray-900 dark:text-white font-bold mb-6">
              <UIcon
                name="ph:rocket-launch"
                class="w-5 h-5 text-purple-400"
              />
              <h3>{{ $t('site.payment.deliveryInformation') }}</h3>
            </div>

            <div
              v-if="order.status === 'paid' || order.status === 'delivered' || order.status === 'active'"
              class="space-y-4"
            >
              <!-- Key/Card Delivery -->
              <div
                v-if="order.productType === 'key' && order.deliveryInfo"
                class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4"
              >
                <p class="text-sm text-emerald-400 mb-2 font-medium">{{ $t('site.payment.licenseKey') }}</p>
                <div class="bg-white dark:bg-black/50 p-3 rounded border border-emerald-500/20 dark:border-white/10 font-mono text-gray-900 dark:text-white text-sm break-all select-all">
                  {{ order.deliveryInfo }}
                </div>
              </div>

              <!-- File Delivery -->
              <div
                v-else-if="order.productType === 'file' && order.deliveryInfo"
                class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
              >
                <p class="text-sm text-blue-400 mb-3 font-medium">{{ $t('site.payment.downloadLink') }}</p>
                <UButton
                  :to="order.deliveryInfo"
                  target="_blank"
                  color="primary"
                  class="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  <UIcon
                    name="ph:download-simple"
                    class="w-5 h-5 mr-2"
                  />
                  {{ $t('site.payment.downloadFile') }}
                </UButton>
              </div>

              <!-- Other Types -->
              <div
                v-else
                class="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap"
              >
                {{ order.deliveryInfo || $t('site.payment.deliveryPendingHint') }}
              </div>
            </div>

            <!-- Unpaid State -->
            <div
              v-else-if="order.payStatus === 'pending'"
              class="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <UIcon
                name="ph:wallet"
                class="w-12 h-12 text-amber-500/50 mb-3"
              />
              <p class="text-gray-500 dark:text-gray-400 mb-4">{{ $t('site.payment.deliveryRequiresPayment') }}</p>
              <UButton
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white font-medium px-8"
                :to="localePath(`/payment/${order.id}`)"
              >
                {{ $t('site.payment.payNow') }}
              </UButton>
            </div>

            <!-- Failed/Expired State -->
            <div
              v-else
              class="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <UIcon
                name="ph:x-circle"
                class="w-12 h-12 text-red-500/50 mb-3"
              />
              <p class="text-gray-500 dark:text-gray-400">{{ $t('site.payment.orderExpiredOrCancelled') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Not Found State -->
      <div
        v-else
        class="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/5 rounded-3xl py-24 text-center shadow-sm dark:shadow-none"
      >
        <UIcon
          name="ph:file-x-bold"
          class="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4 mx-auto"
        />
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('site.payment.orderNotFound') }}</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-8">{{ $t('site.payment.orderNotFoundTips') }}</p>
        <UButton
          :to="localePath('/user/orders')"
          color="neutral"
          variant="solid"
        >
          {{ $t('site.payment.backToOrders') }}
        </UButton>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const { formatCurrencyAmount } = useCurrencyFormat()
const { localePath } = useLocaleRouter()
const route = useRoute()
const router = useRouter() 
const orderId = route.params['slug']?.[2] as string

const { getLocalizedSetting } = useLocalizedSettings()

useHead({
  title: `${t('site.payment.orderDetailPageTitle', { orderId })} - ${getLocalizedSetting('site_name')}`,
})

const { data: order, status } = await useFetch<any>(`/api/orders/detail`, {
  headers: useRequestHeaders(['cookie']),
  lazy: true,
  query: {
    orderId,
  },
  onResponseError({ response }: any) {
    if (response.status === 401) {
      router.push(localePath('/login'))
    }
  },
})

const pending = computed(() => status.value === 'pending')

const payStatusLabel = (payStatus?: string) => {
  if (payStatus === 'paid' || payStatus === 'delivered') return t('site.payment.paid')
  if (payStatus === 'pending') return t('site.payment.pendingPayment')
  if (payStatus === 'failed') return t('site.payment.failed')
  if (payStatus === 'cancelled') return t('site.payment.cancelled')
  if (payStatus === 'expired') return t('site.payment.expired')
  return payStatus || t('site.payment.pendingPayment')
}

const orderStatusLabel = (status?: string) => {
  if (status === 'paid') return t('site.payment.paid')
  if (status === 'delivered') return t('site.payment.delivered')
  if (status === 'active') return t('site.payment.active')
  if (status === 'failed') return t('site.payment.failed')
  if (status === 'cancelled') return t('site.payment.cancelled')
  if (status === 'expired') return t('site.payment.expired')
  return status || t('site.payment.pendingPayment')
}

const productTypeLabel = (productType?: string) => {
  if (productType === 'key') return t('site.payment.productTypeKey')
  if (productType === 'file') return t('site.payment.productTypeFile')
  if (productType === 'subscription') return t('site.payment.productTypeSubscription')
  return productType || t('site.payment.productTypeProduct')
}
</script>
