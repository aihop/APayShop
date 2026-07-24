<template>
  <div class="p-8 relative overflow-hidden group">
    <div class="absolute -right-20 -top-20 w-64 h-64 bg-[#6d4cff]/5 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 group-hover:bg-[#6d4cff]/10"></div>

    <div class="flex justify-between items-center mb-10 relative z-10">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-[#6d4cff]/10 flex items-center justify-center text-[#6d4cff] shadow-inner border border-[#6d4cff]/20 group-hover:rotate-12 transition-transform">
          <UIcon name="ph:credit-card-duotone" class="w-6 h-6"></UIcon>
        </div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('site.payment.workspaceTitle') }}</h3>
      </div>
      <UButton
        v-if="closable"
        color="neutral"
        variant="ghost"
        icon="i-heroicons-x-mark-20-solid"
        class="rounded-xl text-gray-400 dark:text-white/20 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        @click="$emit('close')"
      />
    </div>

    <div class="grid gap-8 md:grid-cols-[240px,minmax(0,1fr)] relative z-10">
      <aside class="space-y-6 md:sticky md:top-6 self-start">
        <div class="bg-gray-50 dark:bg-black/40 rounded-[32px] p-8 border border-gray-100 dark:border-white/5 shadow-inner relative z-10 group/summary">
          <div class="flex justify-between items-end mb-6">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">{{ $t('site.payment.workspaceTotalPayable') }}</p>
              <p class="text-5xl font-bold text-gray-900 dark:text-white tracking-tighter group-hover/summary:scale-105 transition-transform origin-left">{{ displayCurrency }} {{ amount.toFixed(2) }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">{{ $t('site.payment.workspaceQuantity') }}</p>
              <p class="text-xl font-bold text-gray-600 dark:text-white/60">x{{ quantity }}</p>
            </div>
          </div>
          <div class="h-px bg-gray-200 dark:bg-white/5 w-full"></div>
          <p class="mt-6 text-[9px] font-bold text-gray-400 dark:text-white/10">{{ $t('site.payment.workspaceSecurityHint') }}</p>
        </div>

        <div
          v-if="availablePaymentMethods.length > 1"
          class="rounded-[24px] border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/30 p-4 shadow-inner"
        >
          <label class="block text-[9px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20 mb-3 ml-1">{{ $t('site.payment.workspaceSelectMethod') }}</label>
          <div class="grid grid-cols-2 md:grid-cols-1 gap-2">
            <button
              v-for="method in availablePaymentMethods"
              :key="method.code"
              :class="[
                'flex items-center justify-start gap-2.5 p-3 rounded-2xl border transition-all duration-300 font-bold text-[11px] leading-none shadow-inner min-h-[44px] text-left',
                selectedPaymentMethod === method.code
                  ? 'border-[#6d4cff] bg-[#6d4cff]/10 text-[#6d4cff] shadow-[0_10px_30px_rgba(109,76,255,0.2)]'
                  : 'border-gray-200 dark:border-white/5 bg-white dark:bg-black/20 text-gray-400 dark:text-white/40 hover:border-[#6d4cff]/50 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
              ]"
              @click="switchPaymentMethod(method.code)"
            >
              <img
                v-if="method.iconUrl"
                :src="method.iconUrl"
                :alt="method.name"
                class="w-4 h-4 rounded-sm object-contain bg-white/90 p-0.5 shrink-0"
              >
              <UIcon
                v-else
                name="ph:credit-card-bold"
                class="w-4 h-4 shrink-0"
              />
              <span class="min-w-0 truncate">{{ method.name }}</span>
            </button>
          </div>
        </div>
      </aside>

      <div id="payment-info-container" class="min-h-[240px] flex flex-col justify-center">
        <div
          v-if="qrCodeImageUrl && !isFetchingPaymentInfo"
          class="mb-6 rounded-[28px] border border-gray-100 dark:border-white/10 bg-white dark:bg-black/30 p-6 shadow-inner"
        >
          <div class="flex flex-col items-center text-center">
            <p class="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20 mb-3">{{ $t('site.payment.workspaceScanToPay') }}</p>
            <div class="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <img
                :src="qrCodeImageUrl"
                :alt="$t('site.payment.workspaceScanToPay')"
                class="w-52 h-52 object-contain"
              >
            </div>
            <p class="mt-4 text-sm font-medium text-gray-700 dark:text-white/80">{{ qrCodeHint || $t('site.payment.workspaceQrHint') }}</p>
            <a
              v-if="qrCodeLink"
              :href="qrCodeLink"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 text-sm font-semibold text-[#6d4cff] hover:text-[#5a3fe0] transition-colors"
            >
              {{ $t('site.payment.workspaceOpenPaymentLink') }}
            </a>
          </div>
        </div>

        <div
          v-if="isFetchingPaymentInfo"
          class="flex flex-col items-center justify-center py-12 gap-4"
        >
          <UIcon
            name="ph:spinner-gap-bold"
            class="w-10 h-10 animate-spin text-[#6d4cff]"
          />
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/20">{{ $t('site.payment.workspaceInitialisingGateway') }}</p>
        </div>

        <div
          v-else-if="!paymentInfoContent"
          class="text-center py-16 px-10 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10"
        >
          <UIcon name="ph:warning-circle-duotone" class="w-12 h-12 text-gray-300 dark:text-white/10 mx-auto mb-4"></UIcon>
          <p class="text-gray-400 dark:text-white/40 text-sm font-medium">{{ $t('site.payment.workspaceNoMethods') }}</p>
        </div>

        <div
          v-if="paymentInfoContent && !isFetchingPaymentInfo"
          ref="htmlContainer"
          class="payment-html-wrapper w-full rounded-[32px] overflow-hidden"
          v-html="paymentInfoContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRequestHeaders, useRouter, useToast } from '#imports'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

const props = withDefaults(defineProps<{
  orderId: string
  amount: number
  quantity?: number
  closable?: boolean
  redirectOnSuccess?: boolean
}>(), {
  quantity: 1,
  closable: false,
  redirectOnSuccess: false,
})

const emit = defineEmits<{
  close: []
  success: [orderId: string]
}>()

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const { localePath } = useLocaleRouter()
const { getSetting } = useSettings()
const requestHeaders = useRequestHeaders(['cookie'])
const displayCurrency = computed(() => {
  const currency = String(getSetting('currency', 'USD') || 'USD').trim().toUpperCase()
  return currency || 'USD'
})

const isFetchingPaymentInfo = ref(false)
const availablePaymentMethods = ref<any[]>([])
const selectedPaymentMethod = ref('')
const paymentInfoContent = ref('')
const qrCodePayload = ref('')
const qrCodeLink = ref('')
const qrCodeHint = ref('')
const htmlContainer = ref<HTMLElement | null>(null)
const injectedScripts = ref<HTMLScriptElement[]>([])
const qrCodeImageUrl = computed(() => {
  if (!qrCodePayload.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCodePayload.value)}`
})

const clearInjectedScripts = () => {
  injectedScripts.value.forEach((script) => {
    if (script.parentNode) {
      script.parentNode.removeChild(script)
    }
  })
  injectedScripts.value = []
}

const clearQrCodeState = () => {
  qrCodePayload.value = ''
  qrCodeLink.value = ''
  qrCodeHint.value = ''
}

const resetWorkspace = () => {
  clearInjectedScripts()
  clearQrCodeState()
  availablePaymentMethods.value = []
  selectedPaymentMethod.value = ''
  paymentInfoContent.value = ''
  isFetchingPaymentInfo.value = false
}

const executeScripts = () => {
  const container = htmlContainer.value
  if (!container || typeof document === 'undefined') return

  clearInjectedScripts()

  const scripts = container.querySelectorAll('script')
  scripts.forEach((oldScript) => {
    const newScript = document.createElement('script')
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value)
    })

    const scriptContent = oldScript.innerHTML || oldScript.textContent || oldScript.text
    if (scriptContent) {
      newScript.appendChild(document.createTextNode(scriptContent))
    }

    document.body.appendChild(newScript)
    injectedScripts.value.push(newScript)

    if (oldScript.parentNode) {
      oldScript.parentNode.removeChild(oldScript)
    }
  })
}

const switchPaymentMethod = (code: string) => {
  selectedPaymentMethod.value = code
  clearQrCodeState()
  const method = availablePaymentMethods.value.find((item) => item.code === code)
  if (!method) return
  paymentInfoContent.value = method.content
  nextTick(() => {
    executeScripts()
  })
}

const fetchPaymentInfo = async (orderId: string) => {
  isFetchingPaymentInfo.value = true
  try {
    const res: any = await $fetch('/api/payments/info', {
      method: 'POST',
      headers: requestHeaders,
      body: {
        orderId,
        locale: locale.value,
      },
    })

    const methods = res?.data?.methods || []
    availablePaymentMethods.value = methods
    if (methods.length > 0) {
      switchPaymentMethod(methods[0].code)
    }
  } catch (error) {
    console.error('Failed to fetch payment info:', error)
    toast.add({
      title: t('site.payment.workspaceNetworkError'),
      description: t('site.payment.workspaceLoadGatewayFailed'),
      color: 'error',
    })
  } finally {
    isFetchingPaymentInfo.value = false
  }
}

const handlePaymentSuccess = async (event: Event) => {
  const detail = (event as CustomEvent).detail || {}
  const detailOrderId = detail.orderId ? String(detail.orderId) : ''
  if (detailOrderId && detailOrderId !== props.orderId) return

  clearQrCodeState()
  emit('success', props.orderId)

  toast.add({
    title: t('site.payment.paymentSuccessful'),
    description: t('site.payment.workspaceSuccessToast', { orderId: props.orderId }),
    color: 'success',
  })

  if (props.redirectOnSuccess) {
    await router.push(localePath(`/callback/${props.orderId}`))
  }
}

const handlePaymentError = (event: Event) => {
  const detail = (event as CustomEvent).detail || {}
  toast.add({
    title: t('site.payment.workspaceTransactionFailed'),
    description: detail.message || t('site.payment.workspaceExecutionReverted'),
    color: 'error',
  })
}

const handlePaymentQrReady = (event: Event) => {
  const detail = (event as CustomEvent).detail || {}
  const detailOrderId = detail.orderId ? String(detail.orderId) : ''
  if (detailOrderId && detailOrderId !== props.orderId) return

  const payload = String(detail.qrCodeText || detail.payload || detail.paymentUrl || '').trim()
  if (!payload) return

  qrCodePayload.value = payload
  qrCodeLink.value = String(detail.paymentUrl || '').trim()
  qrCodeHint.value = String(detail.message || '').trim()
}

const handlePaymentQrClear = (event: Event) => {
  const detail = (event as CustomEvent).detail || {}
  const detailOrderId = detail.orderId ? String(detail.orderId) : ''
  if (detailOrderId && detailOrderId !== props.orderId) return
  clearQrCodeState()
}

watch(
  () => props.orderId,
  async (orderId) => {
    resetWorkspace()

    if (!orderId) return

    await fetchPaymentInfo(orderId)
  },
  { immediate: true }
)

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('order-success', handlePaymentSuccess)
  window.addEventListener('order-error', handlePaymentError)
  window.addEventListener('payment-qr-ready', handlePaymentQrReady)
  window.addEventListener('payment-qr-clear', handlePaymentQrClear)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('order-success', handlePaymentSuccess)
    window.removeEventListener('order-error', handlePaymentError)
    window.removeEventListener('payment-qr-ready', handlePaymentQrReady)
    window.removeEventListener('payment-qr-clear', handlePaymentQrClear)
  }
  clearInjectedScripts()
})
</script>
