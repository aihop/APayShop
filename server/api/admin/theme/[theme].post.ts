import { themeSettings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const themeName = getRouterParam(event, 'theme')
  if (!themeName) {
    throw createError({ statusCode: 400, message: "Missing theme name" })
  }

  const body = await readBody(event)
  
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: "Invalid configuration data" })
  }

  const configJson = JSON.stringify(body)

  // Upsert theme settings
  const existing = await db.select().from(themeSettings).where(eq(themeSettings.themeName, themeName)).limit(1)
  
  if (existing.length > 0) {
    await db.update(themeSettings)
      .set({ 
        config: configJson,
        updatedAt: new Date()
      })
      .where(eq(themeSettings.themeName, themeName))
  } else {
    await db.insert(themeSettings).values({
      themeName: themeName,
      config: configJson
    })
  }

  return { success: true }
})