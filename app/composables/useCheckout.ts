import { ref, nextTick, onMounted, onUnmounted } from 'vue'
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
  const isFetchingPaymentInfo = ref(false)
  const availablePaymentMethods = ref<any[]>([])
  const selectedPaymentMethod = ref<string>('')
  const paymentInfoContent = ref('')
  const orderId = ref<string | null>(null)
  
  // HTML container reference for script injection
  const htmlContainer = ref<HTMLElement | null>(null)

  const openCheckoutModal = async (productId: number | string, quantity: number, metaData?: any) => {
    // Check guest checkout permission
    const allowGuestCheckout = getSetting('allow_guest_checkout', 'true') === 'true'
    if (!allowGuestCheckout && !loggedIn.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Guest checkout is disabled. Please log in to continue your purchase.',
        color: 'amber',
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
        
        // Prevent body scroll when modal is open
        if (typeof document !== 'undefined') {
          document.body.style.overflow = 'hidden'
        }
        
        fetchPaymentInfo()
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
  const continuePayment = async () => {
    // Check guest checkout permission
    const allowGuestCheckout = getSetting('allow_guest_checkout', 'true') === 'true'
    if (!allowGuestCheckout && !loggedIn.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Guest checkout is disabled. Please log in to continue your purchase.',
        color: 'amber',
        icon: 'i-heroicons-lock-closed',
      })
      router.push('/auth/login')
      return
    }

    if (!orderId.value) {
      toast.add({
        title: 'Order ID is required',
        description: 'Please create an order first',
        color: 'error',
      })
    } else {
      isOrderModalOpen.value = true
      fetchPaymentInfo()
    }
  }

  const closeCheckoutModal = () => {
    isOrderModalOpen.value = false
    isCreatingOrder.value = false
    availablePaymentMethods.value = [] // 清空状态
    selectedPaymentMethod.value = ''
    paymentInfoContent.value = ''
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
    }
  }

  const fetchPaymentInfo = async () => {
    if (availablePaymentMethods.value.length > 0) return

    isFetchingPaymentInfo.value = true
    try {
      const res: any = await $fetch('/api/payments/info', {
        method: 'POST',
        body: {
          orderId: orderId.value,
        },
      })

      if (res && res.code === 0 && res.data?.methods?.length > 0) {
        availablePaymentMethods.value = res.data.methods
        // 默认选中第一个
        switchPaymentMethod(res.data.methods[0].code)
      }
    } catch (e) {
      console.error('Failed to fetch payment info:', e)
      toast.add({
        title: 'Network Error',
        description: 'Failed to load payment gateway',
        color: 'error',
      })
    } finally {
      isFetchingPaymentInfo.value = false
    }
  }

  const switchPaymentMethod = (code: string) => {
    selectedPaymentMethod.value = code
    const method = availablePaymentMethods.value.find(m => m.code === code)
    if (method) {
      paymentInfoContent.value = method.content
      nextTick(() => {
        executeScripts()
      })
    }
  }

  const executeScripts = () => {
    const container = htmlContainer.value
    if (!container) return

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

      if (oldScript.parentNode) {
        oldScript.parentNode.removeChild(oldScript)
      }
    })
  }

  // Global event listeners for payment status
  const handlePaymentSuccess = (e: any) => {
    closeCheckoutModal()
    toast.add({
      title: 'Payment Successful!',
      description: 'Transaction confirmed. Order ID: ' + e.detail.orderId,
      color: 'success',
    })
  }

  const handlePaymentError = (e: any) => {
    toast.add({
      title: 'Transaction Failed',
      description: e.detail.message || 'Payment execution reverted',
      color: 'error',
    })
  }

  // Lifecycle hooks for event listeners
  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('order-success', handlePaymentSuccess)
      window.addEventListener('order-error', handlePaymentError)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('order-success', handlePaymentSuccess)
      window.removeEventListener('order-error', handlePaymentError)
    }
  })

  return {
    isCreatingOrder,
    isOrderModalOpen,
    isFetchingPaymentInfo,
    availablePaymentMethods,
    selectedPaymentMethod,
    paymentInfoContent,
    orderId,
    htmlContainer,
    openCheckoutModal,
    closeCheckoutModal,
    continuePayment,
    switchPaymentMethod,
  }
}