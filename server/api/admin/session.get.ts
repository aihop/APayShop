import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event).catch(() => null)

  if (!session?.admin) {
    throw createError({
      statusCode: 401,
      statusMessage: locale === 'zh' ? '未授权：需要管理员权限' : 'Unauthorized: Admin access required',
    })
  }

  return {
    admin: session.admin,
  }
})
