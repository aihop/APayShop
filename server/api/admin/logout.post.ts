import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  // Deliberately not audited: nobody ever investigates who logged out, and it
  // doubled the volume of the auth records. Logins still are (see login.post.ts).
  await clearUserSession(event)
  return { message: locale === 'zh' ? '已成功退出登录' : 'Logged out successfully' }
})
