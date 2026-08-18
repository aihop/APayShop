export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)
  if (session?.sessionReplaced) {
    return { active: false, reason: session.sessionReplaced }
  }
  return { active: Boolean(session?.user), reason: null }
})
