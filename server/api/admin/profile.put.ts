import { admins } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { oldPassword, newPassword } = body
    
    if (!oldPassword || !newPassword) {
      return { code: 1, message: "Old and new passwords are required" }
    }
    
    const adminUsers = await db.select().from(admins).where(eq(admins.username, 'admin'))
    if (adminUsers.length === 0) {
      return { code: 1, message: "Admin user not found" }
    }
    
    const admin = adminUsers[0]
    
    const isValid = await verifyPassword(admin.passwordHash, oldPassword)
    if (!isValid) {
      return { code: 1, message: "Incorrect old password" }
    }
    
    const hashedNewPassword = await hashPassword(newPassword)
    
    await db.update(admins)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(admins.username, 'admin'))
      
    return { code: 0, message: "Password updated successfully" }
    
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
