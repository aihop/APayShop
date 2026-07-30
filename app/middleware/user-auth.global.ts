export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  if (path !== '/user' && !path.startsWith('/user/')) return

  const { fetchSettings, getSetting } = useSettings()
  await fetchSettings()
  if (getSetting('active_theme') !== 'qingpu') return

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
