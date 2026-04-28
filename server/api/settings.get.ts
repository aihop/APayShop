import { settings } from "../db/schema"
import { db } from '../db/runtime'

export default defineEventHandler(async (event) => {
  return await db.select().from(settings)
})
