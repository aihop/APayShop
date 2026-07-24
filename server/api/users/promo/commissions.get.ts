import { listUserPromoCommissions } from '../../../promo/service'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  return listUserPromoCommissions(session.user.id, 100)
})
