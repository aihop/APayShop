import { cards } from "../../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少 ID' : 'Missing id' })

  try {
    // Optional: check if card is used before deleting
    const [card] = await db.select().from(cards).where(eq(cards.id, parseInt(id))).limit(1)
    
    if (!card) {
      return { code: 1, message: locale === 'zh' ? '卡密不存在' : 'Card not found' }
    }
    
    if (card.isUsed) {
      return { code: 1, message: locale === 'zh' ? '已使用的卡密不能删除' : 'Cannot delete a card that has already been used' }
    }

    await db.delete(cards).where(eq(cards.id, parseInt(id)))
    return { code: 0, message: locale === 'zh' ? '卡密删除成功' : 'Card deleted successfully' }
  } catch (error: any) {
    console.error('Delete card error:', error)
    return { code: 1, message: error.message || (locale === 'zh' ? '服务器内部错误' : 'Internal server error') }
  }
})
