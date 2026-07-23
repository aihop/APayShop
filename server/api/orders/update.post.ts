import { orders } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { requireOrderOwnership } from '../../utils/orderAccess'
import { ORDER_PAY_STATUS } from '../../utils/constants'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { orderId, tradeNo, payMethod } = body

    if (!orderId || !tradeNo) {
      return { code: 1, message: "Order ID and Trade No are required" }
    }

    // 归属校验:只允许订单所有者(登录用户/下单 visitor)更新自己的订单
    const order = await requireOrderOwnership(event, String(orderId))

    // 已支付订单的支付字段是对账依据,禁止客户端改写
    if (order.payStatus === ORDER_PAY_STATUS.PAID) {
      return { code: 1, message: "Order already paid" }
    }

    await db.update(orders)
      .set({ tradeNo: tradeNo, payMethod: payMethod })
      .where(eq(orders.id, order.id))

    return { code: 0, message: "success" }
  } catch (error: any) {
    if (error?.statusCode) throw error
    return { code: 1, message: error.message || "Internal server error" }
  }
})
