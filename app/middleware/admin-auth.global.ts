import { isRouteAllowedForAdmin, adminHasAnyRouteAccess, firstAllowedAdminRoute } from '~/composables/useAdminPermissions'

// Module-scope cache — safe ONLY on the client, where each browser tab gets
// its own JS runtime/module instance. On the server, a Nitro/Node process
// handles requests from MANY different logged-in admins concurrently, so a
// process-wide variable here would leak one admin's session (and therefore
// their route/permission decisions) into another admin's request within the
// same TTL window. Server-side always fetches fresh; never reads or writes
// this cache.
let sessionCache: any = null
let lastFetchAt = 0
const CACHE_TTL_MS = 15_000

async function loadAdminSession(): Promise<any> {
  if (import.meta.client) {
    const now = Date.now()
    if (sessionCache && now - lastFetchAt < CACHE_TTL_MS) {
      return sessionCache
    }
  }
  try {
    const res: any = await $fetch('/api/admin/session', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
    const admin = res?.admin || null
    if (import.meta.client) {
      sessionCache = admin
      lastFetchAt = Date.now()
    }
    return admin
  } catch (e) {
    if (import.meta.client) {
      sessionCache = null
      lastFetchAt = Date.now()
    }
    throw e
  }
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

  // This middleware can run before app.vue's own settings fetch resolves
  // (global route middleware runs ahead of the page tree during SSR), so
  // active_theme — and therefore extensionPermissionDefs — would otherwise
  // read as empty on a cold load. fetchSettings() is cache-guarded, so this
  // is a no-op once app.vue's fetch has already landed.
  const { fetchSettings } = useSettings()
  await fetchSettings()
  const { extensionPermissionDefs } = useAdminExtensions()

  if (!isRouteAllowedForAdmin(path, admin, extensionPermissionDefs.value)) {
    // Fall back to a route this admin can actually reach — '/admin' itself
    // requires the 'dashboard' permission, so redirecting there unconditionally
    // would bounce an admin lacking it right back through this same check.
    return navigateTo(firstAllowedAdminRoute(admin, extensionPermissionDefs.value) || '/admin/profile', { replace: true })
  }
})
