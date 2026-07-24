import { ref } from 'vue'
import { useToast, useRouter } from '#imports'
import { useSettings } from '~/composables/useSettings'
import { useCustomerAuth } from '~/composables/useCustomerAuth'

export const useCheckout = () => {
  const toast = useToast()
  const router = useRouter()
  const { getSetting } = useSettings()
  const { loggedIn } = useCustomerAuth()
  
  const isCreatingOrder = ref(false)
  const isOrderModalOpen = ref(false)
  const orderId = ref<string | null>(null)

  // body 滚动锁交给 UModal(reka-ui DialogRoot modal=true)托管:
  // 手动锁会被遮罩点击/ESC 这些不经过 closeCheckoutModal 的关闭路径绕过,把页面永久锁死
  const openCheckoutModal = async (productId: number | string, quantity: number, metaData?: any) => {
    // Check guest checkout permission
    const allowGuestCheckout = getSetting('allow_guest_checkout', 'true') === 'true'
    if (!allowGuestCheckout && !loggedIn.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Guest checkout is disabled. Please log in to continue your purchase.',
        color: 'warning',
        icon: 'i-heroicons-lock-closed',
      })
      router.push('/auth/login')
      return
    }

    if (isCreatingOrder.value) return

    isCreatingOrder.value = true
    try {
      const res: any = await $fetch('/api/orders/checkout', {
        method: 'POST',
        body: {
          metaData,
          items: [
            {
              productId: productId,
              productNum: quantity,
            },
          ],
        },
      })

      if (res && res.code === 0) {
        orderId.value = res.data?.id || ''
        isOrderModalOpen.value = true
      } else {
        throw new Error(res?.message || 'Failed to create order')
      }
    } catch (e: any) {
      toast.add({
        title: 'Checkout Failed',
        description: e.message || e.data?.message || 'Failed to initialize transaction',
        color: 'error',
      })
    } finally {
      isCreatingOrder.value = false
    }
  }

  // 继续支付
  const continuePayment = async (targetOrderId?: string) => {
    // Check guest checkout permission
    const allowGuestCheckout = getSetting('allow_guest_checkout', 'true') === 'true'
    if (!allowGuestCheckout && !loggedIn.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Guest checkout is disabled. Please log in to continue your purchase.',
        color: 'warning',
        icon: 'i-heroicons-lock-closed',
      })
      router.push('/auth/login')
      return
    }

    if (targetOrderId) {
      orderId.value = targetOrderId
    }

    if (!orderId.value) {
      toast.add({
        title: 'Order ID is required',
        description: 'Please create an order first',
        color: 'error',
      })
    } else {
      isOrderModalOpen.value = true
    }
  }

  const closeCheckoutModal = () => {
    isOrderModalOpen.value = false
    isCreatingOrder.value = false
  }

  return {
    isCreatingOrder,
    isOrderModalOpen,
    orderId,
    openCheckoutModal,
    closeCheckoutModal,
    continuePayment,
  }
}
