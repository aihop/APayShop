export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  if (!path.startsWith('/user/plugins/')) return

  const { fetchSettings } = useSettings()
  await fetchSettings()
  const { findUserPage } = useExtensions()
  if (!findUserPage(path)) return

  const { ready, loggedIn, fetch } = useUserSession()
  if (!ready.value) await fetch()
  if (loggedIn.value) return

  const localePrefix = to.path.match(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i)?.[0] || ''
  return navigateTo({
    path: `${localePrefix}/auth/login`,
    query: { redirect: to.fullPath },
    replace: true,
  })
})
