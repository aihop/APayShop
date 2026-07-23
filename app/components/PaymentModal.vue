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
      <PaymentWorkspace
        v-if="activeOrderId"
        :order-id="activeOrderId"
        :amount="amount"
        :quantity="quantity"
        closable
        @close="closeCheckoutModal"
        @success="closeCheckoutModal"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  openCheckoutModal,
  closeCheckoutModal,
  continuePayment,
  orderId: checkoutOrderId,
} = useCheckout()

const activeOrderId = computed(() => checkoutOrderId.value || props.orderId || '')

const handleOpen = () => {
  if (props.productId && props.quantity) {
    openCheckoutModal(props.productId, props.quantity, props.metaData)
  } else if (props.orderId) {
    continuePayment(props.orderId)
  }
}

defineExpose({
  open: handleOpen,
  close: closeCheckoutModal,
})
</script>
