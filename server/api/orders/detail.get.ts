import { orders, products } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'
import { requireOrderOwnership } from '../../utils/orderAccess'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const orderId = getQuery(event).orderId as string
  
  if (!orderId) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少订单 ID' : 'Missing order id' })
  }

  const order = await requireOrderOwnership(event, orderId)

  let product: any = null
  if (order.productId) {
    const productRows = await db.select({
      name: products.name,
      imageUrl: products.imageUrl,
      type: products.type,
      slug: products.slug,
    }).from(products).where(eq(products.id, order.productId)).limit(1)
    product = productRows[0] || null
  }

  let parsedMetaData = null
  if (order.metaData) {
    try {
      parsedMetaData = typeof order.metaData === 'string' 
        ? JSON.parse(order.metaData) 
        : order.metaData
    } catch (e) {
      console.error('Failed to parse metaData JSON', e)
    }
  }

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    payStatus: order.payStatus,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    tradeNo: order.tradeNo,
    payMethod: order.payMethod,
    contactEmail: order.contactEmail,
    deliveryInfo: order.deliveryInfo,
    metaData: parsedMetaData,
    productName: product?.name || null,
    productImageUrl: product?.imageUrl || null,
    productType: product?.type || null,
    productSlug: product?.slug || null,
  }
})
