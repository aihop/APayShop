import { isRouteAllowedForAdmin, adminHasAnyRouteAccess, firstAllowedAdminRoute } from '~/composables/useAdminPermissions'

let sessionCache: any = null
let lastFetchAt = 0
const CACHE_TTL_MS = 15_000

async function loadAdminSession(): Promise<any> {
  const now = Date.now()
  if (sessionCache && now - lastFetchAt < CACHE_TTL_MS) {
    return sessionCache
  }
  try {
    const res: any = await $fetch('/api/admin/session', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
    sessionCache = res?.admin || null
  } catch (e) {
    sessionCache = null
    lastFetchAt = now
    throw e
  }
  lastFetchAt = now
  return sessionCache
}

export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  const isAdminRoute = path.startsWith('/admin')
  const isPublicAdminRoute =
    path === '/admin/login' ||
    path === '/admin/setup' ||
    path === '/admin/logout' ||
    path === '/admin/profile'

  if (!isAdminRoute) return

  let admin: any = null
  try {
    admin = await loadAdminSession()
  } catch {
    if (isPublicAdminRoute) return
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath },
      replace: true,
    })
  }

  if (!admin) {
    if (isPublicAdminRoute) return
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath },
      replace: true,
    })
  }

  if (isPublicAdminRoute) return

  if (!adminHasAnyRouteAccess(admin)) {
    return navigateTo('/admin/profile', { replace: true })
  }

  if (!isRouteAllowedForAdmin(path, admin)) {
    // Fall back to a route this admin can actually reach — '/admin' itself
    // requires the 'dashboard' permission, so redirecting there unconditionally
    // would bounce an admin lacking it right back through this same check.
    return navigateTo(firstAllowedAdminRoute(admin) || '/admin/profile', { replace: true })
  }
})
