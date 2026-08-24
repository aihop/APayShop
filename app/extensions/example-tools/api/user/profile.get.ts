export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  return {
    extension: 'example-tools',
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  }
})
