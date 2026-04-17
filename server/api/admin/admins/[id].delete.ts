import { admins } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {

  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Admin ID is required' })
    }
    
    // Prevent deleting the default admin user
    const user = await db.select().from(admins).where(eq(admins.id, Number(id)))
    if (user.length === 0) {
      throw createError({ statusCode: 404, message: 'Admin not found' })
    }
    
    if (user[0].username === 'admin') {
      throw createError({ statusCode: 403, message: 'Cannot delete the main admin account' })
    }
    
    await db.delete(admins).where(eq(admins.id, Number(id)))
    
    return { code: 0, message: "Admin deleted successfully" }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete admin'
    })
  }
})
