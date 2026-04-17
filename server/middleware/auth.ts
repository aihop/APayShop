export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 1. 定义受保护的后台路径
  const isAdminPath = pathname.startsWith("/api/admin")
  // 排除不需要校验的路径
  const isAuthPath = pathname.includes("/setup") || pathname.includes("/login")
  const session = await getUserSession(event)
  if (isAdminPath && !isAuthPath) {
    if (!session.admin) {
      throw createError({ 
        statusCode: 401, 
        statusMessage: "Unauthorized: Admin access required" 
      })
    }
  } 
  event.context.user = session.user
  event.context.admin = session.admin
})