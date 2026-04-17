import { cards } from "../../../db/schema"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { productId, cardNumbers } = body

  if (!productId || !cardNumbers || !cardNumbers.length) {
    throw createError({ statusCode: 400, message: "Missing required fields" })
  }

  try {
    const insertData = cardNumbers.map((cardNumber: string) => ({
      productId,
      cardNumber,
      isUsed: false,
      createdAt: new Date()
    }))

    // Bulk insert
    await db.insert(cards).values(insertData)

    return { code: 0, message: `Successfully added ${insertData.length} cards` }
  } catch (error: any) {
    console.error('Add cards error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
