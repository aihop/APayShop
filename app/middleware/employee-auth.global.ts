export default defineNuxtRouteMiddleware(async (to) => {
  const path = stripLocalePrefix(to.path)
  if (path !== '/user' && !path.startsWith('/user/')) return

  const { ready, session, fetch } = useUserSession()
  if (!ready.value) await fetch()

  const employee = (session.value as { employee?: unknown } | null | undefined)?.employee
  if (!employee) return

  const allowed = path === '/user/listing'
    || path.startsWith('/user/listing/')
  if (allowed) return

  const localePrefix = to.path.match(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i)?.[0] || ''
  return navigateTo(`${localePrefix}/user/listing`, { replace: true })
})
