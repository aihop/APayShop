import { products } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'
import { requireOrderOwnership } from '../../utils/orderAccess'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const orderId = query.orderId as string
  
  if (!orderId) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '订单 ID 不能为空' : 'Order ID is required' })
  }

  const order = await requireOrderOwnership(event, orderId)

  let product: any = null
  if (order.productId) {
    const productRows = await db.select({
      name: products.name,
      type: products.type,
      slug: products.slug,
      imageUrl: products.imageUrl,
    }).from(products).where(eq(products.id, order.productId)).limit(1)
    product = productRows[0] || null
  }

  // 敏感信息脱敏：未支付成功前，不返回发货信息
  const deliveryInfo = order.payStatus === 'paid' ? order.deliveryInfo : null

  return {
    code: 0,
    data: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      payStatus: order.payStatus,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      payMethod: order.payMethod,
      deliveryInfo,
      productName: product?.name || null,
      productType: product?.type || null,
      productSlug: product?.slug || null,
      productImageUrl: product?.imageUrl || null,
    }
  }
})
