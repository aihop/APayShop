import { orders, products, users } from "../../db/schema"
import { eq, desc, count, or } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const pageSize = parseInt(query.pageSize as string) || 15
    const offset = (page - 1) * pageSize
    
    // Auth & Identity checks
    const session = await getUserSession(event)
    const userId = (session?.user as any)?.id
    const visitorId = getCookie(event, 'visitor_id')

    if (!userId && !visitorId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized: No user session or visitor cookie found'
      })
    }

    // Build the condition: either belongs to the logged-in user OR the current visitorId
    const authCondition = userId 
      ? or(eq(orders.userId, userId), eq(orders.visitorId, visitorId || ''))
      : eq(orders.visitorId, visitorId as string)
 
    const totalResult = await db.select({ value: count() })
      .from(orders)
      .where(authCondition)
      
    const total = totalResult[0]?.value || 0

    const result = await db.select({
      id: orders.id,
      amount: orders.amount,
      status: orders.status,
      contactEmail: orders.contactEmail,
      payMethod: orders.payMethod,
      tradeNo: orders.tradeNo,
      visitorId: orders.visitorId,
      createdAt: orders.createdAt,
      productName: products.name,
      productSlug: products.slug,
      productId: products.id,
      productImage: products.imageUrl,
      productType: products.type,
      userNickname: users.nickname,
      userEmail: users.email
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .leftJoin(users, eq(orders.userId, users.id))
    .where(authCondition)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset)
    
    return {
      data: result,
      total,
      page,
      pageSize
    }
})
