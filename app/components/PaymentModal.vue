<template>
  <slot
    name="trigger"
    :loading="isCreatingOrder"
    :open="handleOpen"
  ></slot>

  <UModal
    v-model:open="isOrderModalOpen"
    :ui="{ content: 'bg-white dark:bg-[#1a1a1e] border border-gray-200 dark:border-white/10 rounded-[40px] shadow-2xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden' }"
  >
    <template #content>
      <div class="p-8 relative overflow-hidden group">
        <div class="absolute -right-20 -top-20 w-64 h-64 bg-[#6d4cff]/5 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 group-hover:bg-[#6d4cff]/10"></div>
        
        <div class="flex justify-between items-center mb-10 relative z-10">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-[#6d4cff]/10 flex items-center justify-center text-[#6d4cff] shadow-inner border border-[#6d4cff]/20 group-hover:rotate-12 transition-transform">
              <UIcon name="ph:credit-card-duotone" class="w-6 h-6" ></UIcon>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payment Workspace</h3>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            class="rounded-xl text-gray-400 dark:text-white/20 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            @click="closeCheckoutModal"
          />
        </div>

        <div class="bg-gray-50 dark:bg-black/40 rounded-[32px] p-8 mb-10 border border-gray-100 dark:border-white/5 shadow-inner relative z-10 group/summary">
          <div class="flex justify-between items-end mb-6">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">Total Payable</p>
              <p class="text-5xl font-bold text-gray-900 dark:text-white tracking-tighter   group-hover/summary:scale-105 transition-transform origin-left">USD {{ amount.toFixed(2) }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-2">Quantity</p>
              <p class="text-xl font-bold text-gray-600 dark:text-white/60  ">x{{ quantity }}</p>
            </div>
          </div>
          <div class="h-px bg-gray-200 dark:bg-white/5 w-full"></div>
          <p class="mt-6 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-white/10 italic">Secure digital transaction enabled via encrypted gateway</p>
        </div>

        <!-- Payment Info Container -->
        <div class="space-y-8 relative z-10">
          <div
            id="payment-info-container"
            class="min-h-[240px] flex flex-col justify-center"
          >
            <div
              v-if="isFetchingPaymentInfo"
              class="flex flex-col items-center justify-center py-12 gap-4"
            >
              <UIcon
                name="ph:spinner-gap-bold"
                class="w-10 h-10 animate-spin text-[#6d4cff]"
              />
              <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/20">Initialising Gateway...</p>
            </div>

            <div
              v-else-if="!paymentInfoContent"
              class="text-center py-16 px-10 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10"
            >
              <UIcon name="ph:warning-circle-duotone" class="w-12 h-12 text-gray-300 dark:text-white/10 mx-auto mb-4" ></UIcon>
              <p class="text-gray-400 dark:text-white/40 text-sm font-medium">No express payment methods available for this configuration.</p>
            </div>

            <!-- Payment Method Selector -->
            <div
              v-if="availablePaymentMethods.length > 1"
              class="mb-10"
            >
              <label class="block text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-white/20 mb-5 ml-2">Select Method</label>
              <div class="grid grid-cols-2 gap-4">
                <button
                  v-for="method in availablePaymentMethods"
                  :key="method.code"
                  @click="switchPaymentMethod(method.code)"
                  :class="[
                    'flex items-center justify-center p-5 rounded-[20px] border transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-inner',
                    selectedPaymentMethod === method.code 
                      ? 'border-[#6d4cff] bg-[#6d4cff]/10 text-[#6d4cff] shadow-[0_10px_30px_rgba(109,76,255,0.2)]' 
                      : 'border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/20 text-gray-400 dark:text-white/40 hover:border-[#6d4cff]/50 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                  ]"
                >
                  <span>{{ method.name }}</span>
                </button>
              </div>
            </div>

            <!-- Dynamically injected HTML will go here -->
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
  </UModal>
</template>

<script setup lang="ts">
import { useCheckout } from '~/composables/useCheckout'

const props = defineProps<{
  productId?: number | string
  quantity: number
  amount: number
  orderId?: string
  metaData?: any
}>()

const {
  isCreatingOrder,
  isOrderModalOpen,
  isFetchingPaymentInfo,
  availablePaymentMethods,
  selectedPaymentMethod,
  paymentInfoContent,
  htmlContainer,
  openCheckoutModal,
  closeCheckoutModal,
  continuePayment,
  switchPaymentMethod,
  orderId: checkoutOrderId,
} = useCheckout()

const handleOpen = () => {
  if (props.productId && props.quantity) {
    openCheckoutModal(props.productId, props.quantity, props.metaData)
  } else if (props.orderId) {
    checkoutOrderId.value = props.orderId
    continuePayment()
  }
}

defineExpose({
  open: handleOpen,
  close: closeCheckoutModal,
})
</script>