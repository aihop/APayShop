import { admins } from "../../../db/schema"
import { eq, ne, and } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Admin ID is required' })
    }
    
    const body = await readBody(event)
    const { username, password } = body
    
    if (!username) {
      throw createError({ statusCode: 400, message: 'Username is required' })
    }
    
    // Check if another admin has this username
    const existingUser = await db.select().from(admins).where(
      and(
        eq(admins.username, username),
        ne(admins.id, Number(id))
      )
    )
    
    if (existingUser.length > 0) {
      throw createError({ statusCode: 400, message: 'Username already taken by another admin' })
    }
    
    const updateData: any = { username }
    
    if (password) {
      updateData.passwordHash = await hashPassword(password)
    }
    
    await db.update(admins)
      .set(updateData)
      .where(eq(admins.id, Number(id)))
      
    return { code: 0, message: "Admin updated successfully" }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update admin'
    })
  }
})
