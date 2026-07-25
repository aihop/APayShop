// 语言前缀归一走 app/utils/admin-route.ts 单点(auto-import),
// 公开页排除集(login/setup)是鉴权自己的语义,留在本文件表达
export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  const isAdminRoute = path.startsWith('/admin')
  const isPublicAdminRoute = path === '/admin/login' || path === '/admin/setup'

  if (!isAdminRoute || isPublicAdminRoute) {
    return
  }

  try {
    await $fetch('/api/admin/session', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
  } catch {
    return navigateTo({
      path: '/admin/login',
      query: {
        redirect: to.fullPath,
      },
      replace: true,
    })
  }
})
