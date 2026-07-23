<template>
  <div class="min-h-screen bg-gray-50 dark:bg-[#050505] py-10 px-4 sm:px-6 lg:px-8 transition-colors">
    <div class="max-w-6xl mx-auto">
      <div class="mb-6">
        <UButton
          color="neutral"
          variant="ghost"
          :to="localePath('/user/orders')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <UIcon name="ph:arrow-left" class="w-4 h-4 mr-2"></UIcon>
          {{ $t('site.order.myOrders') }}
        </UButton>
      </div>

      <div
        v-if="pending"
        class="grid gap-6 md:grid-cols-[260px,1fr]"
      >
        <div class="h-[360px] rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] animate-pulse"></div>
        <div class="h-[620px] rounded-[40px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] animate-pulse"></div>
      </div>

      <div
        v-else-if="fetchError || !order"
        class="max-w-xl mx-auto bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-[32px] p-8 text-center shadow-sm dark:shadow-none"
      >
        <div class="w-16 h-16 mx-auto mb-5 rounded-2xl border flex items-center justify-center" :class="errorState.iconWrapClass">
          <UIcon :name="errorState.icon" class="w-9 h-9" :class="errorState.iconClass"></UIcon>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ errorState.title }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mb-6">{{ errorState.description }}</p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
            :to="localePath('/products')"
          >
            Browse Products
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :to="localePath('/user/orders')"
          >
            My Orders
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="grid gap-6 md:grid-cols-[260px,1fr]"
      >
        <aside class="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-3xl p-6 h-fit shadow-sm dark:shadow-none">
          <div class="flex items-start gap-4 mb-6">
            <div class="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 shrink-0">
              <img
                v-if="order.productImageUrl"
                :src="order.productImageUrl"
                :alt="order.productName"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600"
              >
                <UIcon name="ph:package" class="w-7 h-7"></UIcon>
              </div>
            </div>
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-2">{{ order.productType || 'product' }}</p>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white leading-tight break-words">{{ order.productName || `Order #${order.id}` }}</h1>
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5 mb-6">
            <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 mb-2">Amount</p>
            <p class="text-4xl font-bold text-gray-900 dark:text-white">${{ Number(order.amount || 0).toFixed(2) }}</p>
          </div>

          <div class="space-y-4 text-sm">
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3">
              <span class="text-gray-500 dark:text-gray-500">{{ $t('site.payment.tradeNo') }}</span>
              <span class="text-gray-900 dark:text-white font-mono text-right break-all">{{ order.tradeNo || 'Pending' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3">
              <span class="text-gray-500 dark:text-gray-500">{{ $t('site.payment.payMethod') }}</span>
              <span class="text-gray-900 dark:text-white capitalize text-right">{{ order.payMethod || 'Pending' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3">
              <span class="text-gray-500 dark:text-gray-500">{{ $t('site.payment.pendingPayment') }}</span>
              <UBadge
                :color="order.payStatus === 'pending' ? 'warning' : order.payStatus === 'paid' ? 'success' : 'neutral'"
                variant="subtle"
                class="capitalize"
              >
                {{ order.payStatus || 'pending' }}
              </UBadge>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-gray-500 dark:text-gray-500">{{ $t('site.payment.paidAt') }}</span>
              <span class="text-gray-900 dark:text-white text-right">{{ order.paidAt ? formatDateTime(order.paidAt) : 'N/A' }}</span>
            </div>
          </div>
        </aside>

        <section class="bg-white dark:bg-[#1a1a1e] border border-gray-200 dark:border-white/10 rounded-[40px] shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden">
          <div
            v-if="resolvedOrderState"
            class="p-10 text-center"
          >
            <div class="w-16 h-16 mx-auto mb-5 rounded-2xl border flex items-center justify-center" :class="resolvedOrderState.iconWrapClass">
              <UIcon
                :name="resolvedOrderState.icon"
                class="w-9 h-9"
                :class="resolvedOrderState.iconClass"
              ></UIcon>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">{{ resolvedOrderState.title }}</h2>
            <p class="text-gray-500 dark:text-white/40 mb-6">
              {{ resolvedOrderState.description }}
            </p>
            <div class="flex justify-center gap-3">
              <UButton
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white"
                :to="localePath(resolvedOrderState.primaryTo)"
              >
                {{ resolvedOrderState.primaryLabel }}
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                :to="localePath(resolvedOrderState.secondaryTo)"
              >
                {{ resolvedOrderState.secondaryLabel }}
              </UButton>
            </div>
          </div>

          <PaymentWorkspace
            v-else
            :order-id="order.id"
            :amount="Number(order.amount || 0)"
            redirect-on-success
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

const { localePath } = useLocaleRouter()
const { formatDateTime } = useFormatTime()
const { getSetting } = useSettings()
const route = useRoute()
const orderId = route.params['slug']?.[1] as string

useHead({
  title: `Payment - ${getSetting('site_name')}`,
  meta: [
    {
      name: 'description',
      content: 'Secure payment page for your order.',
    },
  ],
})

const {
  data: order,
  status,
  error: fetchError,
} = await useFetch<any>('/api/orders/detail', {
  headers: useRequestHeaders(['cookie']),
  lazy: true,
  query: { orderId },
})

const pending = computed(() => status.value === 'pending')

const errorState = computed(() => {
  const statusCode = Number((fetchError.value as any)?.statusCode || (fetchError.value as any)?.status || 0)

  if (statusCode === 401) {
    return {
      icon: 'ph:lock-key-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: 'Payment Link Unavailable',
      description: 'Open this order in the same browser or account that created it, then try again.',
    }
  }

  if (statusCode === 404) {
    return {
      icon: 'ph:link-break-fill',
      iconWrapClass: 'bg-red-500/10 border-red-500/20',
      iconClass: 'text-red-400',
      title: 'Order Not Available',
      description: 'This payment link no longer points to an accessible order. It may have expired, been removed, or belong to a different session.',
    }
  }

  return {
    icon: 'ph:warning-circle-fill',
    iconWrapClass: 'bg-red-500/10 border-red-500/20',
    iconClass: 'text-red-400',
    title: 'Unable To Open Payment',
    description: 'We could not load the payment workspace right now. Please refresh the page or try again from your orders list.',
  }
})

const resolvedOrderState = computed(() => {
  const currentOrder = order.value
  if (!currentOrder) return null

  if (currentOrder.payStatus === 'paid' || currentOrder.status === 'delivered') {
    return {
      icon: 'ph:check-circle-fill',
      iconWrapClass: 'bg-emerald-500/10 border-emerald-500/20',
      iconClass: 'text-emerald-400',
      title: 'Payment Already Completed',
      description: 'This order has already been paid. You can review the latest fulfillment details below.',
      primaryTo: `/callback/${currentOrder.id}`,
      primaryLabel: 'View Delivery',
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: 'Open Order',
    }
  }

  if (currentOrder.payStatus === 'cancelled') {
    return {
      icon: 'ph:x-circle-fill',
      iconWrapClass: 'bg-gray-500/10 border-gray-500/20',
      iconClass: 'text-gray-400',
      title: 'Payment Was Cancelled',
      description: 'This order is no longer waiting for payment. Create a new order if you still want to continue with this purchase.',
      primaryTo: '/products',
      primaryLabel: 'Browse Products',
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: 'Open Order',
    }
  }

  if (currentOrder.status === 'expired' || currentOrder.payStatus === 'expired') {
    return {
      icon: 'ph:clock-countdown-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: 'Order Expired',
      description: 'This payment session has expired. Please create a fresh order before trying again.',
      primaryTo: '/products',
      primaryLabel: 'Create New Order',
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: 'Open Order',
    }
  }

  if (currentOrder.payStatus === 'failed') {
    return {
      icon: 'ph:warning-octagon-fill',
      iconWrapClass: 'bg-red-500/10 border-red-500/20',
      iconClass: 'text-red-400',
      title: 'Payment Failed',
      description: 'The last payment attempt did not complete. Review the order and create a fresh checkout if needed.',
      primaryTo: `/user/orders/${currentOrder.id}`,
      primaryLabel: 'Open Order',
      secondaryTo: '/products',
      secondaryLabel: 'Browse Products',
    }
  }

  if (currentOrder.payStatus && currentOrder.payStatus !== 'pending') {
    return {
      icon: 'ph:warning-circle-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: 'Payment Unavailable',
      description: 'This order is no longer in a payable state. Please review the order timeline for the latest status.',
      primaryTo: `/user/orders/${currentOrder.id}`,
      primaryLabel: 'Open Order',
      secondaryTo: '/products',
      secondaryLabel: 'Browse Products',
    }
  }

  return null
})

watch(
  () => order.value?.payStatus,
  async (payStatus) => {
    if (payStatus === 'paid' || payStatus === 'delivered') {
      await navigateTo(localePath(`/callback/${orderId}`), { replace: true })
    }
  },
  { immediate: true }
)
</script>
