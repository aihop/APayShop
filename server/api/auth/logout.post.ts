import { getRequestLocale } from "../../utils/requestLocale"

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  await clearUserSession(event)
  return { message: locale === 'zh' ? '已成功退出登录' : 'Logged out successfully' }
})
