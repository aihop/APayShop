<template>
  <div class="min-h-[80vh] flex flex-col items-center justify-center p-4">
    <div class="max-w-md w-full bg-[#121214] border border-gray-800/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl"></div>

      <div class="relative z-10">
        <div class="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <UIcon
            name="ph:x-circle-fill"
            class="w-12 h-12 text-yellow-500"
          />
        </div>

        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.paymentCancelled') }}</h1>
        <p class="text-gray-400 mb-8">{{ $t('site.payment.paymentCancelledTips') }}</p>
        <p
          v-if="redirecting && externalCancelUrl"
          class="text-xs text-amber-300/80 mb-6"
        >
          {{ $t('site.payment.redirectingToSource') }}
        </p>

        <div class="space-y-4">
          <UButton
            color="primary"
            size="lg"
            block
            class="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
            to="/"
          >
            {{ $t('site.payment.continueShopping') }}
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            block
            to="/user/orders"
            v-if="loggedIn"
          >
            {{ $t('site.payment.viewMyOrders') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useCustomerAuth } from '~/composables/useCustomerAuth'
const { t } = useI18n()

useHead(() => ({
  title: t('site.payment.cancelledPageTitle'),
  meta: [
    {
      name: 'description',
      content: t('site.payment.cancelledPageDescription'),
    },
  ],
}))

const { loggedIn } = useCustomerAuth()
const route = useRoute()
const orderId = computed(() => String(route.query.orderId || '').trim())
const externalCancelUrl = ref('')
const externalOrderId = ref('')
const redirecting = ref(false)
let redirectTimer: any = null

const buildExternalRedirectUrl = (targetUrl: string) => {
  try {
    const url = new URL(targetUrl)
    if (orderId.value) {
      url.searchParams.set('orderId', orderId.value)
    }
    if (externalOrderId.value) {
      url.searchParams.set('externalOrderId', externalOrderId.value)
    }
    url.searchParams.set('status', 'cancelled')
    return url.toString()
  } catch {
    return targetUrl
  }
}

const scheduleExternalRedirect = (targetUrl: string) => {
  if (!import.meta.client || !targetUrl || redirecting.value) return
  redirecting.value = true
  const resolvedUrl = buildExternalRedirectUrl(targetUrl)
  redirectTimer = window.setTimeout(() => {
    window.location.href = resolvedUrl
  }, 1200)
}

const hydrateCheckoutBridge = async () => {
  if (!orderId.value) return
  try {
    const detail: any = await $fetch(`/api/orders/detail?orderId=${encodeURIComponent(orderId.value)}`)
    const bridge = detail?.metaData?.checkoutBridge
    if (!bridge?.cancelUrl) return
    externalCancelUrl.value = String(bridge.cancelUrl || '').trim()
    externalOrderId.value = String(bridge.externalOrderId || '').trim()
    scheduleExternalRedirect(externalCancelUrl.value)
  } catch (error) {
    console.error('Failed to load checkout bridge detail for cancel callback', error)
  }
}

onMounted(() => {
  void hydrateCheckoutBridge()
})

onUnmounted(() => {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
})
</script>
