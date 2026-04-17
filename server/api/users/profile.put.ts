import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const body = await readBody(event)
  const { nickname, avatarUrl } = body

  if (!nickname && !avatarUrl) {
    return { code: 1, message: "No data to update" }
  }

  try {
    const updates: any = {}
    if (nickname !== undefined) updates.nickname = nickname
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl

    await db.update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))

    // Update session data
    if (nickname !== undefined) session.user.nickname = nickname
    if (avatarUrl !== undefined) session.user.avatarUrl = avatarUrl
    await setUserSession(event, session)

    return { code: 0, message: "Profile updated successfully", user: session.user }
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
