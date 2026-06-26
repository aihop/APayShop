export default defineEventHandler(async (event) => {
  const session = await getUserSession(event).catch(() => null)

  if (!session?.admin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Admin access required',
    })
  }

  return {
    admin: session.admin,
  }
})
