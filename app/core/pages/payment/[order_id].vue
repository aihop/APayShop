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
        class="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"
      >
        <div class="h-[420px] rounded-[32px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1e] animate-pulse"></div>
        <div class="h-[620px] rounded-[32px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1e] animate-pulse"></div>
      </div>

      <div
        v-else-if="fetchError || !order"
        class="max-w-xl mx-auto bg-white dark:bg-[#1a1a1e] border border-gray-200 dark:border-white/10 rounded-[32px] p-8 text-center shadow-xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
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
              {{ $t('site.payment.browseProducts') }}
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :to="localePath('/user/orders')"
          >
              {{ $t('site.order.myOrders') }}
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"
      >
        <aside class="bg-white dark:bg-[#1a1a1e] border border-gray-200 dark:border-white/10 rounded-[32px] p-7 h-full shadow-xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
          <div class="flex items-start gap-4 mb-7">
            <div class="w-20 h-20 rounded-[20px] overflow-hidden bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 shrink-0">
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
                <UIcon name="ph:package" class="w-9 h-9"></UIcon>
              </div>
            </div>
            <div class="min-w-0 pt-1">
              <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-white/45 mb-1.5">{{ resolveProductTypeLabel(order.productType) }}</p>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white leading-[1.3] break-words">{{ order.productName || $t('site.payment.orderTitle', { orderId: order.id }) }}</h1>
            </div>
          </div>

          <div class="rounded-[20px] border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-5 mb-7">
            <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/45 mb-2">{{ $t('site.payment.amountLabel') }}</p>
            <p class="text-[44px] font-bold leading-none tracking-tight text-gray-900 dark:text-white">${{ Number(order.amount || 0).toFixed(2) }}</p>
          </div>

          <div class="space-y-4 text-sm">
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3.5">
              <span class="text-[12px] text-gray-500 dark:text-white/50">{{ $t('site.payment.tradeNo') }}</span>
              <span class="text-gray-900 dark:text-white font-mono text-right break-all text-[13px]">{{ order.tradeNo || $t('site.payment.pending') }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3.5">
              <span class="text-[12px] text-gray-500 dark:text-white/50">{{ $t('site.payment.payMethod') }}</span>
              <span class="text-gray-900 dark:text-white capitalize text-right text-[13px]">{{ order.payMethod || $t('site.payment.pending') }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-3.5">
              <span class="text-[12px] text-gray-500 dark:text-white/50">{{ $t('site.payment.pendingPayment') }}</span>
              <UBadge
                :color="order.payStatus === 'pending' ? 'warning' : order.payStatus === 'paid' ? 'success' : 'neutral'"
                variant="subtle"
                class="capitalize"
              >
                {{ resolvePayStatusLabel(order.payStatus || order.status) }}
              </UBadge>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-[12px] text-gray-500 dark:text-white/50">{{ $t('site.payment.paidAt') }}</span>
              <span class="text-gray-900 dark:text-white text-right text-[13px]">{{ order.paidAt ? formatDateTime(order.paidAt) : $t('site.payment.notAvailable') }}</span>
            </div>
          </div>
        </aside>

        <section class="bg-white dark:bg-[#1a1a1e] border border-gray-200 dark:border-white/10 rounded-[32px] shadow-xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.45)] overflow-hidden h-full">
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

const { t } = useI18n()
const { localePath } = useLocaleRouter()
const { formatDateTime } = useFormatTime()
const { getSetting } = useSettings()
const route = useRoute()
const orderId = route.params['slug']?.[1] as string

useHead(() => ({
  title: `${t('site.payment.checkoutPageTitle')} - ${getSetting('site_name')}`,
  meta: [
    {
      name: 'description',
      content: t('site.payment.checkoutPageDescription'),
    },
  ],
}))

const {
  data: order,
  status,
  error: fetchError,
  refresh,
} = await useFetch<any>('/api/orders/detail', {
  headers: useRequestHeaders(['cookie']),
  lazy: true,
  query: { orderId },
})

const pending = computed(() => status.value === 'pending')
const isCompletingFree = ref(false)

const tryCompleteFreeOrder = async () => {
  const currentOrder = order.value
  if (!currentOrder || isCompletingFree.value) return
  const amount = Number(currentOrder.amount ?? 0)
  const payStatus = String(currentOrder.payStatus || currentOrder.status || '')
  if (amount > 0) return
  if (payStatus === 'paid' || payStatus === 'delivered') {
    await navigateTo(localePath(`/callback/${currentOrder.id}`), { replace: true })
    return
  }
  if (payStatus !== 'pending' && payStatus !== '') return
  isCompletingFree.value = true
  try {
    const res: any = await $fetch('/api/minimal/admin/checkout/orders/complete-free', {
      method: 'POST',
      body: { orderId: currentOrder.id },
    })
    if (res?.code === 0) {
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('order-success', {
            detail: { orderId: currentOrder.id },
          }))
        } catch (e) {
          console.warn('[payment] dispatch order-success failed:', e)
        }
      }
      await navigateTo(localePath(`/callback/${currentOrder.id}`), { replace: true })
    }
  } catch (e: any) {
    console.warn('[payment] complete-free failed, falling back to normal flow:', e)
  } finally {
    isCompletingFree.value = false
  }
}

const resolveProductTypeLabel = (productType?: string) => {
  if (productType === 'key') return t('site.payment.productTypeKey')
  if (productType === 'file') return t('site.payment.productTypeFile')
  if (productType === 'subscription') return t('site.payment.productTypeSubscription')
  if (productType === 'topup') return t('site.payment.productTypeTopup')
  if (productType === 'service') return t('site.payment.productTypeService')
  return productType || t('site.payment.productTypeProduct')
}

const resolvePayStatusLabel = (payStatus?: string) => {
  if (payStatus === 'paid') return t('site.payment.paid')
  if (payStatus === 'pending') return t('site.payment.pendingPayment')
  if (payStatus === 'failed') return t('site.payment.failed')
  if (payStatus === 'cancelled') return t('site.payment.cancelled')
  if (payStatus === 'expired') return t('site.payment.expired')
  if (payStatus === 'delivered') return t('site.payment.delivered')
  if (payStatus === 'active') return t('site.payment.active')
  return payStatus || t('site.payment.pendingPayment')
}

const errorState = computed(() => {
  const statusCode = Number((fetchError.value as any)?.statusCode || (fetchError.value as any)?.status || 0)

  if (statusCode === 401) {
    return {
      icon: 'ph:lock-key-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: t('site.payment.paymentLinkUnavailableTitle'),
      description: t('site.payment.paymentLinkUnavailableDescription'),
    }
  }

  if (statusCode === 404) {
    return {
      icon: 'ph:link-break-fill',
      iconWrapClass: 'bg-red-500/10 border-red-500/20',
      iconClass: 'text-red-400',
      title: t('site.payment.orderUnavailableTitle'),
      description: t('site.payment.orderUnavailableDescription'),
    }
  }

  return {
    icon: 'ph:warning-circle-fill',
    iconWrapClass: 'bg-red-500/10 border-red-500/20',
    iconClass: 'text-red-400',
    title: t('site.payment.unableToOpenPaymentTitle'),
    description: t('site.payment.unableToOpenPaymentDescription'),
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
      title: t('site.payment.paymentAlreadyCompletedTitle'),
      description: t('site.payment.paymentAlreadyCompletedDescription'),
      primaryTo: `/callback/${currentOrder.id}`,
      primaryLabel: t('site.payment.viewDelivery'),
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: t('site.payment.viewOrderDetails'),
    }
  }

  if (currentOrder.payStatus === 'cancelled') {
    return {
      icon: 'ph:x-circle-fill',
      iconWrapClass: 'bg-gray-500/10 border-gray-500/20',
      iconClass: 'text-gray-400',
      title: t('site.payment.paymentWasCancelledTitle'),
      description: t('site.payment.paymentWasCancelledDescription'),
      primaryTo: '/products',
      primaryLabel: t('site.payment.browseProducts'),
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: t('site.payment.viewOrderDetails'),
    }
  }

  if (currentOrder.status === 'expired' || currentOrder.payStatus === 'expired') {
    return {
      icon: 'ph:clock-countdown-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: t('site.payment.orderExpiredTitle'),
      description: t('site.payment.orderExpiredDescription'),
      primaryTo: '/products',
      primaryLabel: t('site.payment.createNewOrder'),
      secondaryTo: `/user/orders/${currentOrder.id}`,
      secondaryLabel: t('site.payment.viewOrderDetails'),
    }
  }

  if (currentOrder.payStatus === 'failed') {
    return {
      icon: 'ph:warning-octagon-fill',
      iconWrapClass: 'bg-red-500/10 border-red-500/20',
      iconClass: 'text-red-400',
      title: t('site.payment.paymentFailed'),
      description: t('site.payment.paymentFailedStateDescription'),
      primaryTo: `/user/orders/${currentOrder.id}`,
      primaryLabel: t('site.payment.viewOrderDetails'),
      secondaryTo: '/products',
      secondaryLabel: t('site.payment.browseProducts'),
    }
  }

  if (currentOrder.payStatus && currentOrder.payStatus !== 'pending') {
    return {
      icon: 'ph:warning-circle-fill',
      iconWrapClass: 'bg-amber-500/10 border-amber-500/20',
      iconClass: 'text-amber-400',
      title: t('site.payment.paymentUnavailableTitle'),
      description: t('site.payment.paymentUnavailableDescription'),
      primaryTo: `/user/orders/${currentOrder.id}`,
      primaryLabel: t('site.payment.viewOrderDetails'),
      secondaryTo: '/products',
      secondaryLabel: t('site.payment.browseProducts'),
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

watch(
  () => [order.value, status.value],
  () => {
    if (status.value !== 'success') return
    tryCompleteFreeOrder()
  },
  { immediate: true }
)
</script>
