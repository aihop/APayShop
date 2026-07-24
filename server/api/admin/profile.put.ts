import { admins } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { getRequestLocale } from '../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        passwordsRequired: '旧密码和新密码不能为空',
        adminNotFound: '管理员不存在',
        incorrectOldPassword: '旧密码错误',
        passwordUpdated: '密码更新成功',
        internalError: '服务器内部错误',
      }
    : {
        passwordsRequired: 'Old and new passwords are required',
        adminNotFound: 'Admin user not found',
        incorrectOldPassword: 'Incorrect old password',
        passwordUpdated: 'Password updated successfully',
        internalError: 'Internal server error',
      }
  try {
    const body = await readBody(event)
    const { oldPassword, newPassword } = body
    
    if (!oldPassword || !newPassword) {
      return { code: 1, message: messages.passwordsRequired }
    }
    
    const adminUsers = await db.select().from(admins).where(eq(admins.username, 'admin'))
    if (adminUsers.length === 0) {
      return { code: 1, message: messages.adminNotFound }
    }
    
    const admin = adminUsers[0]
    
    const isValid = await verifyPassword(admin.passwordHash, oldPassword)
    if (!isValid) {
      return { code: 1, message: messages.incorrectOldPassword }
    }
    
    const hashedNewPassword = await hashPassword(newPassword)
    
    await db.update(admins)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(admins.username, 'admin'))
      
    return { code: 0, message: messages.passwordUpdated }
    
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { code: 1, message: error.message || messages.internalError }
  }
})
