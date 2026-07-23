import { getMasterAgentTeamReport } from '../../../promo/service'

export default defineEventHandler(async (event) => {
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  return getMasterAgentTeamReport(session.user.id)
})
