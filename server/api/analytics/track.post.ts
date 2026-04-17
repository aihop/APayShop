import { trackVisitorEvent } from '../../utils/visitorAnalytics'

const allowedEvents = new Set([
  'page_view',
  'product_view',
  'begin_checkout',
  'order_paid',
  'auth',
])

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const session = await getUserSession(event).catch(() => null)
  const eventName = typeof body?.eventName === 'string' ? body.eventName : ''

  if (!allowedEvents.has(eventName)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid analytics event',
    })
  }

  await trackVisitorEvent(event, {
    eventName,
    eventAction: typeof body?.eventAction === 'string' ? body.eventAction : null,
    productId: typeof body?.productId === 'number' ? body.productId : null,
    orderId: typeof body?.orderId === 'string' ? body.orderId : null,
    path: typeof body?.path === 'string' ? body.path : null,
    referrer: typeof body?.referrer === 'string' ? body.referrer : null,
    userId: (session as any)?.user?.id || null,
  })

  return { success: true }
})
