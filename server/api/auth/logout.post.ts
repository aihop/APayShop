import { getRequestLocale } from "../../utils/requestLocale"
import { endWebSession } from '../../utils/userSessions'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event).catch(() => null)
  if (session?.sessionId) await endWebSession(session.sessionId, Number(session.user?.id) || undefined)
  await clearUserSession(event)
  return { message: locale === 'zh' ? '已成功退出登录' : 'Logged out successfully' }
})
