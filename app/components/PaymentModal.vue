<template>
  <slot
    name="trigger"
    :loading="isCreatingOrder"
    :open="handleOpen"
  ></slot>

  <UModal
    v-model:open="isOrderModalOpen"
    :ui="{ content: 'bg-[#121214] border border-gray-800' }"
  >
    <template #content>
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Payment Order</h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            class="-my-1"
            @click="closeCheckoutModal"
          />
        </div>

        <div class="bg-black/30 rounded-xl p-4 mb-6 border border-gray-800">
          <div class="flex justify-between mb-2">
            <span class="text-gray-400">Total Amount</span>
            <span class="font-bold text-white">USD {{ amount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Quantity</span>
            <span class="text-white">x{{ quantity }}</span>
          </div>
        </div>

        <!-- Payment Info Container -->
        <div class="space-y-6">
          <div
            id="payment-info-container"
            class="min-h-[200px] flex flex-col justify-center"
          >
            <div
              v-if="isFetchingPaymentInfo"
              class="flex justify-center py-8"
            >
              <UIcon
                name="ph:spinner-gap-bold"
                class="w-8 h-8 animate-spin text-purple-500"
              />
            </div>

            <div
              v-else-if="!paymentInfoContent"
              class="text-center py-8 text-gray-500 text-sm"
            >
              No express payment methods available.
            </div>

            <!-- Payment Method Selector -->
            <div
              v-if="availablePaymentMethods.length > 1"
              class="mb-6"
            >
              <label class="block text-sm font-medium text-gray-400 mb-3">Select Payment Method</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="method in availablePaymentMethods"
                  :key="method.code"
                  @click="switchPaymentMethod(method.code)"
                  :class="[
                    'flex items-center justify-center p-3 rounded-xl border transition-all duration-200',
                    selectedPaymentMethod === method.code 
                      ? 'border-purple-500 bg-purple-500/10 text-white' 
                      : 'border-gray-700 bg-black/20 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  ]"
                >
                  <span class="font-medium">{{ method.name }}</span>
                </button>
              </div>
            </div>

            <!-- Dynamically injected HTML will go here -->
            <div
              v-if="paymentInfoContent && !isFetchingPaymentInfo"
              ref="htmlContainer"
              class="payment-html-wrapper w-full"
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