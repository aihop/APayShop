import { cards } from "../../../db/schema"
import { db } from '../../../db/runtime'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const body = await readBody(event)
  const { productId, cardNumbers } = body

  if (!productId || !cardNumbers || !cardNumbers.length) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '缺少必填字段' : 'Missing required fields' })
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

    return { code: 0, message: locale === 'zh' ? `成功添加 ${insertData.length} 张卡密` : `Successfully added ${insertData.length} cards` }
  } catch (error: any) {
    console.error('Add cards error:', error)
    return { code: 1, message: error.message || (locale === 'zh' ? '服务器内部错误' : 'Internal server error') }
  }
})
