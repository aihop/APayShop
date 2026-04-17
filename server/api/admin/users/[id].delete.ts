import { users } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'User ID is required' })
    }

    const user = await db.select().from(users).where(eq(users.id, Number(id)))
    if (user.length === 0) {
      throw createError({ statusCode: 404, message: 'User not found' })
    }

    await db.delete(users).where(eq(users.id, Number(id)))

    return { code: 0, message: 'User deleted successfully' }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete user',
    })
  }
})
