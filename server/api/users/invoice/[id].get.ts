import { eq, and } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { orders, products } from '../../../db/schema'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        orderIdRequired: '订单 ID 不能为空',
        invoiceNotFound: '发票不存在',
        customPurchase: '自定义购买',
      }
    : {
        unauthorized: 'Unauthorized',
        orderIdRequired: 'Order ID is required',
        invoiceNotFound: 'Invoice not found',
        customPurchase: 'Custom Purchase',
      }
  const session: any = await requireUserSession(event)
  if (!session || !session.user || !session.user.id) {
    throw createError({
      statusCode: 401,
      message: messages.unauthorized
    })
  }

  const orderId = getRouterParam(event, 'id')
  if (!orderId) {
    throw createError({
      statusCode: 400,
      message: messages.orderIdRequired
    })
  }

  const userId = session.user.id

  const orderRecord = await db.select().from(orders as any)
    .where(and(
      eq(orders.id, orderId),
      eq(orders.userId, userId)
    ))
    .limit(1)

  if (!orderRecord.length) {
    throw createError({
      statusCode: 404,
      message: messages.invoiceNotFound
    })
  }
  const order: any = orderRecord[0]

  let productDescription = messages.customPurchase
  if (order.productId) {
    const productRecord = await db.select({ name: products.name as any }).from(products as any).where(eq(products.id as any, order.productId)).limit(1)
    if (productRecord.length) {
      productDescription = (productRecord[0] as any).name
    }
  }

  // Use the order's paid date, or fallback to created date if not paid yet
  const issueDate = order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt)
  
  // Format dates: "Mar 10, 2026"
  const formattedDate = issueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return {
    id: order.id,
    status: order.payStatus, // e.g. "paid"
    dateIssue: formattedDate,
    amount: Number(order.amount),
    description: productDescription,
    qty: 1, // Defaulting to 1 for our current products
    rate: Number(order.amount), // Rate equals amount for qty=1
    currency: 'USD', // You can dynamically change this based on DB later if needed
    client: {
      name: order.contactEmail || session.user.email,
      email: order.contactEmail || session.user.email,
    }
  }
})
