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
      <aside class="md:sticky md:top-6 self-start">
        <div class="bg-gray-50 dark:bg-black/40 rounded-[32px] p-6 border border-gray-100 dark:border-white/5 shadow-inner relative z-10 group/summary">
          <div class="flex justify-between items-end mb-5">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">{{ $t('site.payment.workspaceTotalPayable') }}</p>
              <p class="text-5xl font-bold text-gray-900 dark:text-white tracking-tighter group-hover/summary:scale-105 transition-transform origin-left">{{ displayCurrency }} {{ amount.toFixed(2) }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">{{ $t('site.payment.workspaceQuantity') }}</p>
              <p class="text-xl font-bold text-gray-600 dark:text-white/60">x{{ quantity }}</p>
            </div>
          </div>
          <div class="h-px bg-gray-200 dark:bg-white/5 w-full" v-if="availablePaymentMethods.length > 1"></div>
          <div
            v-if="availablePaymentMethods.length > 1"
            class="mt-5"
          >
            <label class="mb-3 ml-1 block text-[9px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20">{{ $t('site.payment.workspaceSelectMethod') }}</label>
            <div class="grid grid-cols-2 gap-2 md:grid-cols-1">
              <button type="button"
                v-for="method in availablePaymentMethods"
                :key="method.code"
                :class="[
                  'flex min-h-[42px] items-center justify-start gap-2 rounded-2xl border px-3 py-2.5 text-left text-[11px] font-bold leading-none transition-all duration-300',
                  selectedPaymentMethod === method.code
                    ? 'border-[#6d4cff] bg-[#6d4cff]/10 text-[#6d4cff] shadow-[0_10px_30px_rgba(109,76,255,0.16)]'
                    : 'border-gray-200 dark:border-white/5 bg-white dark:bg-black/20 text-gray-400 dark:text-white/40 hover:border-[#6d4cff]/50 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                ]"
                @click="switchPaymentMethod(method.code)"
              >
                <img
                  v-if="method.iconUrl"
                  :src="method.iconUrl"
                  :alt="method.name"
                  class="h-4 w-4 shrink-0 rounded-sm bg-white/90 p-0.5 object-contain"
                >
                <UIcon
                  v-else
                  name="ph:credit-card-bold"
                  class="h-4 w-4 shrink-0"
                />
                <span class="min-w-0 truncate">{{ method.name }}</span>
              </button>
            </div>
          </div>
        </div>
        
        <div
          v-if="availablePaymentMethods.length <= 1 && selectedPaymentMethod"
          class="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[10px] font-medium text-gray-500 dark:bg-white/5 dark:text-white/40"
        >
          <UIcon name="ph:credit-card-bold" class="h-3.5 w-3.5 shrink-0" />
          <span class="min-w-0 truncate">{{ selectedMethodLabel }}</span>
        </div>

      </aside>

      <div id="payment-info-container" class="min-h-[240px]">
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
          v-else-if="!paymentInfoContent && !qrCodeImageUrl"
          class="text-center py-16 px-10 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10"
        >
          <UIcon name="ph:warning-circle-duotone" class="w-12 h-12 text-gray-300 dark:text-white/10 mx-auto mb-4"></UIcon>
          <p class="text-gray-400 dark:text-white/40 text-sm font-medium">{{ $t('site.payment.workspaceNoMethods') }}</p>
        </div>

        <div
          v-else-if="hasQrAndContent"
          class="space-y-4"
        >
          <div
            class="lg:hidden flex rounded-[20px] border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-black/20 p-1.5"
          >
            <button
              type="button"
              class="flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold tracking-[0.08em] transition-all"
              :class="activePanel === 'qr'
                ? 'bg-white dark:bg-white/10 text-[#6d4cff] dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white'"
              @click="activePanel = 'qr'"
            >
              {{ $t('site.payment.workspaceScanToPay') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold tracking-[0.08em] transition-all"
              :class="activePanel === 'details'
                ? 'bg-white dark:bg-white/10 text-[#6d4cff] dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white'"
              @click="activePanel = 'details'"
            >
              {{ selectedMethodLabel }}
            </button>
          </div>

          <div class="flex flex-col gap-5 lg:grid lg:grid-cols-[280px,minmax(0,1fr)]">
            <section
              class="rounded-[28px] border border-gray-100 dark:border-white/10 bg-white dark:bg-black/30 p-6 shadow-inner"
              :class="{ 'max-lg:hidden': activePanel !== 'qr' }"
            >
              <div class="flex flex-col items-center text-center">
                <p class="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20">{{ $t('site.payment.workspaceScanToPay') }}</p>
                <div class="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <img
                    :src="qrCodeImageUrl"
                    :alt="$t('site.payment.workspaceScanToPay')"
                    class="h-52 w-52 object-contain"
                  >
                </div>
                <p class="mt-4 text-sm font-medium text-gray-700 dark:text-white/80">{{ qrCodeHint || $t('site.payment.workspaceQrHint') }}</p>
                <a
                  v-if="qrCodeLink"
                  :href="qrCodeLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-3 text-sm font-semibold text-[#6d4cff] transition-colors hover:text-[#5a3fe0]"
                >
                  {{ $t('site.payment.workspaceOpenPaymentLink') }}
                </a>
              </div>
            </section>

            <section
              class="rounded-[28px] border border-gray-100 dark:border-white/10 bg-white dark:bg-black/20 p-4 shadow-inner"
              :class="{ 'max-lg:hidden': activePanel !== 'details' }"
            >
              <div class="mb-3 flex items-center justify-between gap-3 px-2">
                <div class="min-w-0">
                  <p class="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20">{{ selectedMethodLabel }}</p>
                </div>
              </div>
              <div
                ref="htmlContainer"
                class="payment-html-wrapper payment-html-panel w-full rounded-[24px] overflow-hidden"
                v-html="paymentInfoContent"
              ></div>
            </section>
          </div>
        </div>

        <div
          v-else-if="qrCodeImageUrl"
          class="rounded-[28px] border border-gray-100 dark:border-white/10 bg-white dark:bg-black/30 p-6 shadow-inner"
        >
          <div class="flex flex-col items-center text-center">
            <p class="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-white/20">{{ $t('site.payment.workspaceScanToPay') }}</p>
            <div class="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <img
                :src="qrCodeImageUrl"
                :alt="$t('site.payment.workspaceScanToPay')"
                class="h-52 w-52 object-contain"
              >
            </div>
            <p class="mt-4 text-sm font-medium text-gray-700 dark:text-white/80">{{ qrCodeHint || $t('site.payment.workspaceQrHint') }}</p>
            <a
              v-if="qrCodeLink"
              :href="qrCodeLink"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 text-sm font-semibold text-[#6d4cff] transition-colors hover:text-[#5a3fe0]"
            >
              {{ $t('site.payment.workspaceOpenPaymentLink') }}
            </a>
          </div>
        </div>

        <div
          v-else-if="paymentInfoContent"
          ref="htmlContainer"
          class="payment-html-wrapper payment-html-panel w-full rounded-[32px] overflow-hidden"
          v-html="paymentInfoContent"
        ></div>
      </div>
    </div>

    <div class="relative z-10 mt-8 text-center">
      <p class="px-2 text-[10px] leading-5 text-gray-400 dark:text-white/18">
        {{ $t('site.payment.workspaceSecurityHint') }}
      </p>
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
const activePanel = ref<'qr' | 'details'>('details')
const htmlContainer = ref<HTMLElement | null>(null)
const injectedScripts = ref<HTMLScriptElement[]>([])
const selectedMethod = computed(() => availablePaymentMethods.value.find((item) => item.code === selectedPaymentMethod.value) || null)
const selectedMethodLabel = computed(() => selectedMethod.value?.name || t('site.payment.workspaceSelectMethod'))
const hasQrAndContent = computed(() => Boolean(qrCodeImageUrl.value && paymentInfoContent.value))
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
  activePanel.value = 'details'
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
  activePanel.value = 'qr'
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

watch(qrCodeImageUrl, (value) => {
  if (value) {
    activePanel.value = 'qr'
    return
  }
  if (paymentInfoContent.value) {
    activePanel.value = 'details'
  }
})
</script>

<style scoped>
.payment-html-panel {
  background: transparent;
}

.payment-html-wrapper :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
}

.payment-html-wrapper :deep(img),
.payment-html-wrapper :deep(canvas),
.payment-html-wrapper :deep(svg),
.payment-html-wrapper :deep(iframe) {
  max-width: 100%;
}

.payment-html-wrapper :deep(iframe) {
  display: block;
}
</style>
