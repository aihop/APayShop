import { approvePendingPromoAgentRelation, rejectPendingPromoAgentRelation } from '../../../../promo/service'
import { getRequestLocale } from '../../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        relationIdRequired: '关联 ID 不能为空',
        invalidAction: '无效操作',
      }
    : {
        unauthorized: 'Unauthorized',
        relationIdRequired: 'Relation ID is required',
        invalidAction: 'Invalid action',
      }
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
  }

  const relationId = Number(getRouterParam(event, 'id') || 0)
  const body = await readBody(event)
  const action = String(body?.action || '').trim().toLowerCase()

  if (!relationId) {
    throw createError({ statusCode: 400, message: messages.relationIdRequired })
  }

  if (action === 'approve') {
    return approvePendingPromoAgentRelation({
      relationId,
      masterAgentUserId: session.user.id,
    })
  }

  if (action === 'reject') {
    return rejectPendingPromoAgentRelation({
      relationId,
      masterAgentUserId: session.user.id,
    })
  }

  throw createError({ statusCode: 400, message: messages.invalidAction })
})
