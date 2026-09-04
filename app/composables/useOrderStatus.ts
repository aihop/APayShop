import { useI18n } from '#imports'

export enum OrderPayStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  CLOSED = 'closed',
  DELETED = 'deleted',
}

export enum OrderFulfillmentStatus {
  NONE = 'none',
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  DELIVERED = 'delivered',
  FULFILLED = 'fulfilled',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DELETED = 'deleted',
}

export const useOrderStatus = () => {
  const { t, te } = useI18n()

  const getPayStatusLabel = (payStatus?: string | OrderPayStatus | null): string => {
    const status = String(payStatus || OrderPayStatus.PENDING).toLowerCase()
    const key = `admin.orders.pay_status_${status}`
    if (te(key)) return t(key)

    const fallbackMap: Record<string, string> = {
      [OrderPayStatus.PENDING]: '待支付',
      [OrderPayStatus.PAID]: '已支付',
      [OrderPayStatus.FAILED]: '支付失败',
      [OrderPayStatus.REFUNDED]: '已退款',
      [OrderPayStatus.CANCELLED]: '已取消',
      [OrderPayStatus.EXPIRED]: '已过期',
      [OrderPayStatus.CLOSED]: '已关闭',
      [OrderPayStatus.DELETED]: '已删除',
    }
    return fallbackMap[status] || status
  }

  const getPayStatusColor = (payStatus?: string | OrderPayStatus | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    const status = String(payStatus || OrderPayStatus.PENDING).toLowerCase()
    switch (status) {
      case OrderPayStatus.PAID:
        return 'success'
      case OrderPayStatus.PENDING:
        return 'warning'
      case OrderPayStatus.FAILED:
      case OrderPayStatus.DELETED:
      case OrderPayStatus.EXPIRED:
        return 'error'
      case OrderPayStatus.REFUNDED:
      case OrderPayStatus.CANCELLED:
      case OrderPayStatus.CLOSED:
        return 'info'
      default:
        return 'neutral'
    }
  }

  const getFulfillmentStatusLabel = (status?: string | OrderFulfillmentStatus | null): string => {
    const rawStatus = String(status || OrderFulfillmentStatus.PENDING).toLowerCase()
    const normalizedKey = rawStatus === 'fulfilled' ? 'delivered' : rawStatus
    const key = `admin.orders.status_${normalizedKey}`
    if (te(key)) return t(key)

    const fallbackMap: Record<string, string> = {
      [OrderFulfillmentStatus.NONE]: '无状态',
      [OrderFulfillmentStatus.PENDING]: '待履约',
      [OrderFulfillmentStatus.PROCESSING]: '处理中',
      [OrderFulfillmentStatus.ACTIVE]: '已激活',
      [OrderFulfillmentStatus.DELIVERED]: '已发货',
      [OrderFulfillmentStatus.FULFILLED]: '已发货',
      [OrderFulfillmentStatus.COMPLETED]: '已完成',
      [OrderFulfillmentStatus.EXPIRED]: '已过期',
      [OrderFulfillmentStatus.FAILED]: '失败',
      [OrderFulfillmentStatus.CANCELLED]: '已取消',
      [OrderFulfillmentStatus.DELETED]: '已删除',
    }
    return fallbackMap[rawStatus] || rawStatus
  }

  const getFulfillmentStatusColor = (status?: string | OrderFulfillmentStatus | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    const s = String(status || OrderFulfillmentStatus.PENDING).toLowerCase()
    switch (s) {
      case OrderFulfillmentStatus.DELIVERED:
      case OrderFulfillmentStatus.FULFILLED:
      case OrderFulfillmentStatus.COMPLETED:
        return 'success'
      case OrderFulfillmentStatus.PENDING:
      case OrderFulfillmentStatus.PROCESSING:
      case OrderFulfillmentStatus.ACTIVE:
        return 'warning'
      case OrderFulfillmentStatus.FAILED:
      case OrderFulfillmentStatus.EXPIRED:
      case OrderFulfillmentStatus.DELETED:
        return 'error'
      case OrderFulfillmentStatus.CANCELLED:
        return 'info'
      default:
        return 'neutral'
    }
  }

  return {
    OrderPayStatus,
    OrderFulfillmentStatus,
    getPayStatusLabel,
    getPayStatusColor,
    getFulfillmentStatusLabel,
    getFulfillmentStatusColor,
  }
}
