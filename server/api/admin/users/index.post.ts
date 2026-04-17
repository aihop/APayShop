import { users } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { username, password } = body

    const email = String(username || '').trim()

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        message: 'Email and password are required',
      })
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email))
    if (existingUser.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Email already exists',
      })
    }

    const passwordHash = await hashPassword(password)

    await db.insert(users).values({
      email,
      passwordHash,
      nickname: email.split('@')[0] || email,
    })

    return { code: 0, message: 'User created successfully' }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create user',
    })
  }
})
