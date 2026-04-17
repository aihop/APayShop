import { posts } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })

  try {
    await db.delete(posts).where(eq(posts.id, parseInt(id)))
    return { code: 0, message: "Post deleted successfully" }
  } catch (error: any) {
    console.error('Delete post error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
