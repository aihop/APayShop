import { paymentMethods } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })
  
  if (event.method === "PUT") {
    const body = await readBody(event)
    const updateData = { ...body }
    delete updateData.id
    delete updateData.createdAt
    delete updateData.isLocalOnly
    delete updateData.hasLocalFiles
    
    // Ensure script/html fields are passed as strings
    if (updateData.info === undefined) updateData.info = null
    if (updateData.create === undefined) updateData.create = null
    if (updateData.callback === undefined) updateData.callback = null

    try {
      return await db.update(paymentMethods).set(updateData).where(eq(paymentMethods.id, parseInt(id))).returning()
    } catch (e: any) {
      console.error('Database update error:', e)
      throw createError({
        statusCode: 500,
        message: 'Failed query: ' + e.message,
      })
    }
  }
  
  if (event.method === "DELETE") {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, parseInt(id)))
    return { success: true }
  }
})
