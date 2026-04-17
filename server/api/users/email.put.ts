import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const body = await readBody(event)
  const { newEmail, password } = body

  if (!newEmail || !password) {
    return { code: 1, message: "Email and password are required" }
  }

  try {
    const userRecords = await db.select().from(users).where(eq(users.id, session.user.id))
    if (userRecords.length === 0) {
      return { code: 1, message: "User not found" }
    }

    const user = userRecords[0]

    const isValid = await verifyPassword(user.passwordHash, password)
    if (!isValid) {
      return { code: 1, message: "Incorrect password" }
    }

    // Check if new email is already taken
    const existingUser = await db.select().from(users).where(eq(users.email, newEmail))
    if (existingUser.length > 0) {
      return { code: 1, message: "Email is already in use" }
    }

    await db.update(users)
      .set({ email: newEmail })
      .where(eq(users.id, session.user.id))

    // Update session data
    session.user.email = newEmail
    await setUserSession(event, session)

    return { code: 0, message: "Email updated successfully", user: session.user }
  } catch (error: any) {
    console.error('Update email error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
