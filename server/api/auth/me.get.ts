import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../../db/runtime'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = Number(session.user?.id)

  if (!userId) {
    return { user: session.user }
  }

  // 实时从数据库拉取最新的用户信息
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const dbUser = userRows[0]
  if (!dbUser) {
    return { user: session.user }
  }

  const emailVerified = Boolean(dbUser.emailVerifiedAt)
  const updatedUser = {
    ...session.user,
    id: dbUser.id,
    email: dbUser.email,
    nickname: dbUser.nickname,
    avatarUrl: dbUser.avatarUrl,
    emailVerified,
    emailVerifiedAt: dbUser.emailVerifiedAt || null,
  }

  // 同步更新服务端 Session Cookie
  await setUserSession(event, {
    ...session,
    user: updatedUser,
  })

  return {
    user: updatedUser,
  }
})
