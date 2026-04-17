// 使用 as const 锁定字面量类型，方便 TypeScript 提取类型
export const ORDER_STATUS = {
  NONE: 'none',
  PROCESSING: 'processing', // 处理中
  ACTIVE: 'active', // 订阅、服务生效中
  DELIVERED: 'delivered', // 已服务
  EXPIRED: 'expired', // 已过期
  FAILED: 'failed', // 已失败
  COMPLETED: 'completed' // 已完成
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_OPTIONS = Object.values(ORDER_STATUS);

export const ORDER_PAY_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
} as const;

export type OrderPayStatus = typeof ORDER_PAY_STATUS[keyof typeof ORDER_PAY_STATUS];
export const ORDER_PAY_STATUS_OPTIONS = Object.values(ORDER_PAY_STATUS);