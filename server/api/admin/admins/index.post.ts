import { admins } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { username, password } = body
    
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: 'Username and password are required'
      })
    }
    
    // Check if admin already exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.username, username))
    if (existingAdmin.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Username already exists'
      })
    }
    
    const hashedPassword = await hashPassword(password)
    
    await db.insert(admins).values({
      username,
      passwordHash: hashedPassword
    })
    
    return { code: 0, message: "Admin created successfully" }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create admin'
    })
  }
})
