import { users } from "../../../db/schema"
import { and, eq, ne } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'User ID is required' })
    }

    const body = await readBody(event)
    const { username, password } = body
    const email = String(username || '').trim()

    if (!email) {
      throw createError({ statusCode: 400, message: 'Email is required' })
    }

    const existingUser = await db.select().from(users).where(
      and(
        eq(users.email, email),
        ne(users.id, Number(id)),
      ),
    )

    if (existingUser.length > 0) {
      throw createError({ statusCode: 400, message: 'Email already taken by another user' })
    }

    const updateData: any = {
      email,
      nickname: email.split('@')[0] || email,
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password)
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))

    return { code: 0, message: 'User updated successfully' }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update user',
    })
  }
})
