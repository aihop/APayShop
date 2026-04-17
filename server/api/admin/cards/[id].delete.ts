import { cards } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Missing id" })

  try {
    // Optional: check if card is used before deleting
    const [card] = await db.select().from(cards).where(eq(cards.id, parseInt(id))).limit(1)
    
    if (!card) {
      return { code: 1, message: "Card not found" }
    }
    
    if (card.isUsed) {
      return { code: 1, message: "Cannot delete a card that has already been used" }
    }

    await db.delete(cards).where(eq(cards.id, parseInt(id)))
    return { code: 0, message: "Card deleted successfully" }
  } catch (error: any) {
    console.error('Delete card error:', error)
    return { code: 1, message: error.message || "Internal server error" }
  }
})
