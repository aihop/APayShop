import { themeSettings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import fs from 'fs'
import path from 'path'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {

  const themeName = getRouterParam(event, 'theme')
  if (!themeName) {
    throw createError({ statusCode: 400, message: "Missing theme name" })
  }

  // 1. Read theme.json from the file system
  const themeDir = path.resolve(process.cwd(), `app/themes/${themeName}`)
  const schemaPath = path.join(themeDir, 'theme.json')
  
  let schema = null
  if (fs.existsSync(schemaPath)) {
    try {
      const fileContent = fs.readFileSync(schemaPath, 'utf-8')
      schema = JSON.parse(fileContent)
    } catch (e) {
      console.error(`Failed to parse theme.json for ${themeName}`, e)
    }
  }

  // 2. Read saved config from database
  const savedSettingsList = await db.select().from(themeSettings).where(eq(themeSettings.themeName, themeName)).limit(1)
  
  let config = {}
  if (savedSettingsList.length > 0 && savedSettingsList[0].config) {
    try {
      config = JSON.parse(savedSettingsList[0].config)
    } catch (e) {
      console.error(`Failed to parse config from DB for ${themeName}`, e)
    }
  }

  return {
    schema,
    config
  }
})