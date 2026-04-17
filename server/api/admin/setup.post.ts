import { admins } from "../../db/schema"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const existingUsers = await db.select().from(admins).limit(1)
  
  if (existingUsers.length > 0) {
    throw createError({ statusCode: 403, message: "Admin already initialized" })
  }
  
  const body = await readBody(event)
  const { username, password } = body
  
  if (!username || !password) throw createError({ statusCode: 400, message: "Missing credentials" })
  
  const passwordHash = await hashPassword(password)
  
  await db.insert(admins).values({
    username,
    passwordHash: passwordHash
  })
  
  return { success: true, message: "Admin initialized" }
})
