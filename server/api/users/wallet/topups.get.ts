import { listUserTopups } from '../../../utils/topupLedger'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }
  const query = getQuery(event)
  const result = await listUserTopups(Number(session.user.id), Number(query.page || 1), Number(query.pageSize || 20))
  return { code: 0, data: result }
})
