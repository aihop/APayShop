<template>
  <div class="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-[#121214] border border-gray-800/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl"></div>

      <div
        v-if="orderStatus === 'pending'"
        class="relative z-10"
      >
        <UIcon
          name="ph:spinner-gap"
          class="w-16 h-16 text-primary-500 animate-spin mx-auto mb-6"
        />
        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.processingPayment') }}</h1>
        <p class="text-gray-400 mb-6">{{ $t('site.payment.processingPaymentTips') }}</p>
        <div class="text-sm font-mono text-gray-500 bg-black/30 py-2 px-4 rounded-lg inline-block">
          Order ID: {{ orderId }}
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
        v-else-if="orderStatus === 'paid'"
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

        <div
          v-if="deliveryInfo"
          class="bg-black/40 border border-gray-800 rounded-xl p-4 text-left mb-6"
        >
          <h3 class="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{{ $t('site.payment.productDetails') }}</h3>
          <div class="text-white font-mono break-all">{{ deliveryInfo }}</div>
        </div>

        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white w-full justify-center"
          :to="localePath('/')"
        >
          {{ $t('site.payment.returnToShop') }}
        </UButton>
      </div>

      <div
        v-else
        class="relative z-10"
      >
        <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <UIcon
            name="ph:x-circle-fill"
            class="w-10 h-10 text-red-500"
          />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">{{ $t('site.payment.paymentFailed') }}</h1>
        <p class="text-gray-400 mb-6">{{ $t('site.payment.paymentFailedTips') }}</p>
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
import { ref, onMounted, onUnmounted } from 'vue'
const { localePath } = useLocaleRouter()

const route = useRoute()
const orderId = route.params['slug']?.[1] as string

const payStatus = ref('pending')
const deliveryInfo = ref('')
let pollInterval: any = null
let pollCount = 0
const MAX_POLLS = 20 // Stop polling after ~1 minute

const checkStatus = async () => {
  if (!orderId) {
    payStatus.value = 'failed'
    return
  }

  try {
    const res: any = await $fetch(`/api/orders/status?orderId=${orderId}`)
    if (res.code === 0 && res.data) {
      if (res.data.payStatus === 'paid') {
        payStatus.value = 'paid'
        deliveryInfo.value = res.data.deliveryInfo
        stopPolling()
      } else if (res.data.payStatus === 'failed') {
        payStatus.value = 'failed'
        stopPolling()
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

  // 3. 如果仍未支付成功，则开启轮询作为兜底（等待异步 Webhook）
  if (payStatus.value === 'pending') {
    pollInterval = setInterval(checkStatus, 3000)
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>