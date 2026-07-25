import { isRouteAllowedForAdmin, adminHasAnyRouteAccess, firstAllowedAdminRoute, useAdminSession } from '~/composables/useAdminPermissions'

export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  const isAdminRoute = path.startsWith('/admin')
  const isPublicAdminRoute =
    path === '/admin/login' ||
    path === '/admin/setup' ||
    path === '/admin/logout' ||
    path === '/admin/profile'

  if (!isAdminRoute) return

  // Single shared source of truth (see loadAdmin/resetAdmin in
  // useAdminSession) — this used to keep its own separate session cache,
  // which meant two independent caches had to be kept in sync and both
  // invalidated on login/logout. They drifted: login/logout only ever reset
  // one of them, so switching accounts in the same tab kept showing the
  // previous admin's permissions until a hard refresh. One cache means one
  // thing to invalidate, which login.vue / AdminHeader.vue now do via
  // loadAdmin(true) / resetAdmin(). Uses useAdminSession(), NOT the full
  // useAdminPermissions() — that one calls useI18n(), which throws outside
  // a component setup context, and route middleware isn't one.
  const { admin: adminRef, loadAdmin } = useAdminSession()
  await loadAdmin()
  const admin = adminRef.value

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
