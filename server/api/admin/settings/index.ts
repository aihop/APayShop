import { settings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  
  if (event.method === "GET") {
    return await db.select().from(settings)
  }
  
  if (event.method === "POST") {
    const body = await readBody(event)
    
    // Upsert logic for each setting
    for (const [key, value] of Object.entries(body)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
      
      if (existing.length) {
        await db.update(settings).set({ value: String(value) }).where(eq(settings.key, key))
      } else {
        await db.insert(settings).values({ key, value: String(value) })
      }
    }
    
    return { success: true }
  }
})
