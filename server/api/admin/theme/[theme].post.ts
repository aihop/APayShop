import { themeSettings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const themeName = getRouterParam(event, 'theme')
  if (!themeName) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少主题名称' : 'Missing theme name' })
  }

  const body = await readBody(event)
  
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '配置数据无效' : 'Invalid configuration data' })
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
