import { settings } from "../db/schema"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  return await db.select().from(settings)
})
