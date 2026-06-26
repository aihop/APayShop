const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

export default defineNuxtRouteMiddleware(async (to) => {
  const path = normalizeAdminPath(to.path)
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
