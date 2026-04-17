import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const body = await readBody(event)
  const { oldPassword, newPassword } = body

  if (!oldPassword || !newPassword) {
    return { code: 1, message: "Old and new passwords are required" }
  }

  try {
    const userRecords = await db.select().from(users).where(eq(users.id, session.user.id))
    if (userRecords.length === 0) {
      return { code: 1, message: "User not found" }
    }

    const user = userRecords[0]

    const isValid = await verifyPassword(user.passwordHash, oldPassword)
    if (!isValid) {
      return { code: 1, message: "Incorrect old password" }
    }

    const hashedNewPassword = await hashPassword(newPassword)

    await db.update(users)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(users.id, session.user.id))

    return { code: 0, message: "Password updated successfully" }
  } catch (error: any) {
    console.error('Update password error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
