import { ref } from 'vue'
import { useToast, useRouter, useI18n } from '#imports'
import { useSettings } from '~/composables/useSettings'
import { useCustomerAuth } from '~/composables/useCustomerAuth'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

export const useCheckout = () => {
  const toast = useToast()
  const router = useRouter()
  const { getSetting } = useSettings()
  const { loggedIn } = useCustomerAuth()
  const { localePath } = useLocaleRouter()
  const { locale } = useI18n()
  
  const isCreatingOrder = ref(false)
  const isOrderModalOpen = ref(false)
  const orderId = ref<string | null>(null)
  const orderAmount = ref(0)
  const orderCurrency = ref('USD')

  // 0 元/免费订单：直接视为支付成功，跳过 PaymentWorkspace，走 callback 展示成功页
  const handleFreeOrderSuccess = (targetOrderId: string) => {
    orderId.value = targetOrderId
    isCreatingOrder.value = false
    isOrderModalOpen.value = false

    // 触发全局 order-success 事件（让订阅签发、tenant-keys sync 等 side effect 照常运行）
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('order-success', {
          detail: { orderId: targetOrderId },
        }))
      } catch (e) {
        console.warn('[useCheckout] dispatch order-success failed:', e)
      }
    }

    toast.add({
      title: 'Payment Successful',
      description: `Order ${targetOrderId} has been completed.`,
      color: 'success',
      icon: 'ph:check-circle-bold',
    })

    // 与 PaymentWorkspace redirectOnSuccess 行为保持一致：跳转 /callback/{orderId}
    router.push(localePath(`/callback/${targetOrderId}`))
  }

  // 对"历史/遗留的 pending 0 元订单"做兜底补单 + 跳转
  const completeFreeOrder = async (targetOrderId: string) => {
    try {
      isCreatingOrder.value = true
      const res: any = await $fetch('/api/minimal/admin/checkout/orders/complete-free', {
        method: 'POST',
        body: { orderId: targetOrderId },
      })
      if (res?.code === 0) {
        handleFreeOrderSuccess(targetOrderId)
        return true
      }
      throw new Error(res?.message || 'Failed to complete free order')
    } catch (e: any) {
      toast.add({
        title: 'Checkout Failed',
        description: e.message || e.data?.message || 'Failed to complete free order',
        color: 'error',
      })
      return false
    } finally {
      if (isCreatingOrder.value) isCreatingOrder.value = false
    }
  }

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
        icon: 'ph:lock-key-bold',
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
          locale: locale.value,
          items: [
            {
              productId: productId,
              productNum: quantity,
            },
          ],
        },
      })

      if (res && res.code === 0) {
        const newOrderId = res.data?.id || ''
        const amount = Number(res.data?.amount ?? 0)
        orderAmount.value = amount
        orderCurrency.value = String(res.data?.currency || 'USD').toUpperCase()
        const isFreeOrder = Boolean(res.data?.isFreeOrder) || amount <= 0

        if (isFreeOrder && newOrderId) {
          handleFreeOrderSuccess(newOrderId)
          return
        }

        orderId.value = newOrderId
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
      // 0 元单已在 handleFreeOrderSuccess 中关闭 loading，其他路径统一在 finally 兜底释放
      if (isCreatingOrder.value) {
        isCreatingOrder.value = false
      }
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
        icon: 'ph:lock-key-bold',
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
      return
    }

    // 先查订单详情，若是 0 元 pending → 自动补单并跳成功页，避免 PaymentWorkspace 死胡同
    try {
      isCreatingOrder.value = true
      const detail: any = await $fetch('/api/orders/detail', {
        query: { orderId: orderId.value },
        headers: typeof document !== 'undefined' ? useRequestHeaders(['cookie']) : undefined,
      })
      const amount = Number(detail?.amount ?? 0)
      orderAmount.value = amount
      orderCurrency.value = String(detail?.currency || 'USD').toUpperCase()
      const payStatus = String(detail?.payStatus || detail?.status || '')
      if (amount <= 0 && (payStatus === 'pending' || payStatus === '')) {
        await completeFreeOrder(orderId.value)
        return
      }
      if (amount <= 0 && (payStatus === 'paid' || payStatus === 'delivered')) {
        handleFreeOrderSuccess(orderId.value)
        return
      }
    } catch (e) {
      console.warn('[useCheckout] continuePayment pre-check failed, fallback to modal:', e)
    } finally {
      if (isCreatingOrder.value) isCreatingOrder.value = false
    }

    isOrderModalOpen.value = true
  }

  const closeCheckoutModal = () => {
    isOrderModalOpen.value = false
    isCreatingOrder.value = false
  }

  return {
    isCreatingOrder,
    isOrderModalOpen,
    orderId,
    orderAmount,
    orderCurrency,
    openCheckoutModal,
    closeCheckoutModal,
    continuePayment,
    completeFreeOrder,
    handleFreeOrderSuccess,
  }
}
