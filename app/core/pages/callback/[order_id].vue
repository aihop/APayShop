<template>
  <div class="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
    <div class="max-w-5xl w-full bg-[#121214] border border-gray-800/50 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl"></div>

      <div
        v-if="payStatus === 'pending'"
        class="relative z-10 text-center"
      >
        <UIcon
          name="ph:spinner-gap"
          class="w-16 h-16 text-primary-500 animate-spin mx-auto mb-6"
        />
        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.processingPayment') }}</h1>
        <p class="text-gray-400 mb-6">{{ $t('site.payment.processingPaymentTips') }}</p>
        <div class="text-sm font-mono text-gray-500 bg-black/30 py-2 px-4 rounded-lg inline-block">
          {{ $t('site.payment.orderIdLabel') }}: {{ orderId }}
        </div>
        <p class="my-6">
          <UButton
            color="primary"
            variant="soft"
            :to="localePath(`/user/orders/${orderId}`)"
          >{{ $t('site.payment.viewOrderDetails') }}</UButton>
        </p>
      </div>

      <div
        v-else-if="payStatus === 'paid'"
        class="relative z-10"
      >
        <div class="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
          <UIcon
            name="ph:check-circle-fill"
            class="w-10 h-10 text-emerald-500"
          />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.paymentSuccessful') }}</h1>
        <p class="text-gray-400 mb-6">{{ $t('site.payment.paymentSuccessfulTips') }}</p>
        <p
          v-if="redirecting && externalReturnUrl"
          class="text-xs text-emerald-300/80 mb-6"
        >
          {{ $t('site.payment.redirectingAfterPayment') }}
        </p>

        <div
          v-if="order"
          class="mb-6 rounded-2xl border border-white/10 bg-black/30 p-5"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-center">
            <div class="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                v-if="order.productImageUrl"
                :src="order.productImageUrl"
                :alt="order.productName || orderId"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-gray-600"
              >
                <UIcon name="ph:package" class="h-8 w-8" />
              </div>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-emerald-300">
                  {{ resolvedProductType || 'paid' }}
                </span>
                <span class="text-lg font-semibold text-white">{{ order.productName || orderId }}</span>
              </div>
              <p class="text-sm text-gray-400">
                {{ $t('site.payment.successTips') }}
              </p>
            </div>
            <UButton
              v-if="order.productSlug"
              :to="localePath(`/products/${order.productSlug}`)"
              target="_blank"
              color="neutral"
              variant="outline"
            >
              <UIcon name="ph:arrow-square-out" class="mr-1 h-4 w-4" />
              View Product
            </UButton>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 text-left">
            <div class="mb-6 flex items-center gap-2 text-white">
              <UIcon name="ph:credit-card" class="h-5 w-5 text-purple-400" />
              <h3 class="font-semibold">{{ $t('site.payment.PaymentDetails') }}</h3>
            </div>
            <div class="space-y-4 text-sm">
              <div class="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                <span class="text-gray-400">{{ $t('site.payment.orderIdLabel') }}</span>
                <span class="font-mono text-white">{{ orderId }}</span>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                <span class="text-gray-400">{{ $t('site.payment.payMethod') }}</span>
                <span class="text-white">{{ order?.payMethod || 'N/A' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                <span class="text-gray-400">{{ $t('site.payment.tradeNo') }}</span>
                <span class="font-mono text-white">{{ order?.tradeNo || 'Pending' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                <span class="text-gray-400">{{ $t('site.payment.contactEmail') }}</span>
                <span class="text-white">{{ order?.contactEmail || 'N/A' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-gray-400">{{ $t('site.payment.paidAt') }}</span>
                <span class="text-white">{{ order?.paidAt ? formatDateTime(order.paidAt) : 'N/A' }}</span>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 text-left">
            <div class="mb-6 flex items-center gap-2 text-white">
              <UIcon name="ph:rocket-launch" class="h-5 w-5 text-purple-400" />
              <h3 class="font-semibold">Delivery Information</h3>
            </div>

            <div
              v-if="resolvedProductType === 'key' && resolvedDeliveryInfo"
              class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-sm font-medium text-emerald-300">Your License Key</p>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="copyDeliveryInfo"
                >
                  {{ copied ? 'Copied' : 'Copy Key' }}
                </UButton>
              </div>
              <div class="rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm text-white break-all select-all">
                {{ resolvedDeliveryInfo }}
              </div>
            </div>

            <div
              v-else-if="resolvedProductType === 'file' && resolvedDeliveryInfo"
              class="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4"
            >
              <p class="mb-3 text-sm font-medium text-blue-300">Your Download Link</p>
              <UButton
                :to="resolvedDeliveryInfo"
                target="_blank"
                color="primary"
                class="mb-3 w-full justify-center bg-blue-600 text-white hover:bg-blue-500"
              >
                <UIcon name="ph:download-simple" class="mr-2 h-5 w-5" />
                Download File
              </UButton>
              <p class="break-all text-xs text-blue-100/70">{{ resolvedDeliveryInfo }}</p>
            </div>

            <div
              v-else-if="resolvedProductType === 'subscription'"
              class="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4"
            >
              <p class="mb-2 text-sm font-medium text-purple-300">Subscription Activated</p>
              <p class="text-sm leading-6 text-purple-100/85 whitespace-pre-wrap">
                {{ resolvedDeliveryInfo || 'Your subscription is active and ready to use.' }}
              </p>
            </div>

            <div
              v-else-if="resolvedProductType === 'topup'"
              class="rounded-xl border border-green-500/20 bg-green-500/10 p-4"
            >
              <p class="mb-2 text-sm font-medium text-green-300">Balance Updated</p>
              <p class="text-sm leading-6 text-green-100/85 whitespace-pre-wrap">
                {{ resolvedDeliveryInfo || 'Your balance top-up has been applied successfully.' }}
              </p>
            </div>

            <div
              v-else-if="resolvedProductType === 'service' || resolvedOrderStatus === 'processing'"
              class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"
            >
              <p class="mb-2 text-sm font-medium text-amber-300">Service Request Received</p>
              <p class="text-sm leading-6 text-amber-100/85 whitespace-pre-wrap">
                {{ resolvedDeliveryInfo || 'Your payment has been received. Our team will continue processing this service order.' }}
              </p>
            </div>

            <div
              v-else
              class="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <p class="text-sm leading-6 text-gray-300 whitespace-pre-wrap">
                {{ resolvedDeliveryInfo || 'Your order has been paid successfully. Delivery details will appear here once they are ready.' }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <UButton
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
            :to="localePath(`/user/orders/${orderId}`)"
          >
            {{ $t('site.payment.viewOrderDetails') }}
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :to="localePath('/')"
          >
            {{ $t('site.payment.returnToShop') }}
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="relative z-10 text-center"
      >
        <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <UIcon
            name="ph:x-circle-fill"
            class="w-10 h-10 text-red-500"
          />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.paymentFailed') }}</h1>
        <p class="text-gray-400 mb-6">{{ $t('site.payment.paymentFailedTips') }}</p>
        <p
          v-if="redirecting && externalCancelUrl"
          class="text-xs text-amber-300/80 mb-6"
        >
          {{ $t('site.payment.redirectingToSource') }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          class="w-full justify-center"
          :to="localePath('/')"
        >
          {{ $t('site.payment.returnToShop') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
const { t } = useI18n()
const { localePath } = useLocaleRouter()
const { formatDateTime } = useFormatTime()

useHead(() => ({
  title: t('site.payment.pageTitle'),
  meta: [
    {
      name: 'description',
      content: t('site.payment.pageDescription'),
    },
  ],
}))

const route = useRoute()
const orderId = route.params['slug']?.[1] as string

const payStatus = ref('pending')
const order = ref<any>(null)
const deliveryInfo = ref('')
const externalReturnUrl = ref('')
const externalCancelUrl = ref('')
const externalOrderId = ref('')
const redirecting = ref(false)
const copied = ref(false)
let pollInterval: any = null
let redirectTimer: any = null
let copyTimer: any = null
let pollCount = 0
const MAX_POLLS = 20 // Stop polling after ~1 minute

const resolvedDeliveryInfo = computed(() => order.value?.deliveryInfo || deliveryInfo.value || '')
const resolvedProductType = computed(() => String(order.value?.productType || '').trim().toLowerCase())
const resolvedOrderStatus = computed(() => String(order.value?.status || '').trim().toLowerCase())

const buildExternalRedirectUrl = (targetUrl: string, status: 'paid' | 'failed' | 'cancelled') => {
  try {
    const url = new URL(targetUrl)
    url.searchParams.set('orderId', orderId)
    if (externalOrderId.value) {
      url.searchParams.set('externalOrderId', externalOrderId.value)
    }
    url.searchParams.set('status', status)
    return url.toString()
  } catch {
    return targetUrl
  }
}

const scheduleExternalRedirect = (targetUrl: string, status: 'paid' | 'failed' | 'cancelled') => {
  if (!import.meta.client || !targetUrl || redirecting.value) return
  redirecting.value = true
  const resolvedUrl = buildExternalRedirectUrl(targetUrl, status)
  redirectTimer = window.setTimeout(() => {
    window.location.href = resolvedUrl
  }, 1200)
}

const hydrateCheckoutBridge = async () => {
const copyDeliveryInfo = async () => {
  if (!resolvedDeliveryInfo.value || typeof window === 'undefined') return
  try {
    await navigator.clipboard.writeText(resolvedDeliveryInfo.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch (error) {
    console.error('Failed to copy delivery info', error)
  }
}

  if (!orderId) return
  try {
    const detail: any = await $fetch(`/api/orders/detail?orderId=${encodeURIComponent(orderId)}`)
    const bridge = detail?.metaData?.checkoutBridge
    order.value = detail
    if (detail?.payStatus) {
      payStatus.value = detail.payStatus
    }
    if (detail?.deliveryInfo) {
      deliveryInfo.value = detail.deliveryInfo
    }
    if (!bridge) return
    externalReturnUrl.value = String(bridge.returnUrl || '').trim()
    externalCancelUrl.value = String(bridge.cancelUrl || '').trim()
    externalCancelUrl.value = String(bridge.cancelUrl || '').trim()
    externalOrderId.value = String(bridge.externalOrderId || '').trim()

    if (payStatus.value === 'paid' && externalReturnUrl.value) {
      scheduleExternalRedirect(externalReturnUrl.value, 'paid')
    }
    if (payStatus.value === 'failed' && externalCancelUrl.value) {
      scheduleExternalRedirect(externalCancelUrl.value, 'failed')
    }
  } catch (error) {
    console.error('Failed to load checkout bridge detail', error)
  }
}

const checkStatus = async () => {
  if (!orderId) {
    payStatus.value = 'failed'
    return
  }

  try {
    const res: any = await $fetch(`/api/orders/status?orderId=${orderId}`)
    if (res.code === 0 && res.data) {
      order.value = {
        ...(order.value || {}),
        ...res.data,
      }
      if (res.data.payStatus === 'paid') {
        payStatus.value = 'paid'
        deliveryInfo.value = res.data.deliveryInfo
        stopPolling()
        if (externalReturnUrl.value) {
          scheduleExternalRedirect(externalReturnUrl.value, 'paid')
        }
      } else if (res.data.payStatus === 'failed') {
        payStatus.value = 'failed'
        stopPolling()
        if (externalCancelUrl.value) {
          scheduleExternalRedirect(externalCancelUrl.value, 'failed')
        }
      }
    }
  } catch (e) {
    console.error('Failed to check order status', e)
  }

  pollCount++
  if (pollCount >= MAX_POLLS) {
    stopPolling()
  }
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const triggerCapture = async () => {
  const queryParams = new URLSearchParams(route.query as Record<string, string>).toString()
  if (queryParams && orderId) {
    try {
      // 主动调用 webhook，触发后端向 PayPal 发起 Capture 扣款请求
      await $fetch(`/api/webhooks/${orderId}?${queryParams}`, { method: 'POST' })
    } catch (e) {
      console.error('Failed to trigger capture webhook', e)
    }
  }
}

onMounted(async () => {
  // 1. 主动触发捕获（如果是支持主动 Capture 的网关如 PayPal，这里会完成秒级扣款和状态更新）
  await triggerCapture()

  // 2. 检查一次最新状态
  await checkStatus()
  await hydrateCheckoutBridge()

  // 3. 如果仍未支付成功，则开启轮询作为兜底（等待异步 Webhook）
  if (payStatus.value === 'pending') {
    pollInterval = setInterval(checkStatus, 3000)
  }
})

onUnmounted(() => {
  stopPolling()
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})
</script>
