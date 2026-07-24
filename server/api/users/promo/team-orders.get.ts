import { listMasterAgentTeamOrders } from '../../../promo/service'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit || 100), 200)
  return listMasterAgentTeamOrders(session.user.id, limit)
})
