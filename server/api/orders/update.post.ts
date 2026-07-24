import { orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { requireOrderOwnership } from '../../utils/orderAccess'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        required: '订单 ID 和交易号不能为空',
        alreadyPaid: '订单已支付',
        success: '成功',
        internalError: '服务器内部错误',
      }
    : {
        required: 'Order ID and Trade No are required',
        alreadyPaid: 'Order already paid',
        success: 'success',
        internalError: 'Internal server error',
      }
  try {
    const body = await readBody(event)
    const { orderId, tradeNo, payMethod } = body

    if (!orderId || !tradeNo) {
      return { code: 1, message: messages.required }
    }

    // 归属校验:只允许订单所有者(登录用户/下单 visitor)更新自己的订单
    const order = await requireOrderOwnership(event, String(orderId))

    // 已支付订单的支付字段是对账依据,禁止客户端改写
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      return { code: 1, message: messages.alreadyPaid }
    }

    await db.update(orders)
      .set({ tradeNo: tradeNo, payMethod: payMethod })
      .where(eq(orders.id, order.id))

    return { code: 0, message: messages.success }
  } catch (error: any) {
    if (error?.statusCode) throw error
    return { code: 1, message: error.message || messages.internalError }
  }
})
