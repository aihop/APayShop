import { getRequestLocale } from '../../utils/requestLocale'
import { recordOperationFromEvent } from '../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  // Read the identity before clearing — afterResponse would find nothing left.
  const admin = (event.context as any).admin
  await clearUserSession(event)

  if (admin?.id) {
    await recordOperationFromEvent(event, {
      actorId: admin.id,
      actorName: admin.username,
      action: 'logout',
      resource: 'auth',
      statusCode: 200,
    })
  }

  return { message: locale === 'zh' ? '已成功退出登录' : 'Logged out successfully' }
})
