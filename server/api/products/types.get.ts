import { products } from "../../db/schema"
import { db } from '@nuxthub/db'
import { eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  // 查询所有激活状态的商品类型并去重
  // 由于 Drizzle 在部分环境下不支持 SELECT DISTINCT 的特定写法，我们可以查出后在代码层去重
  // 这种查询量通常很小，不会有性能问题
  const result = await db.select({
    type: products.type
  })
  .from(products)
  .where(eq(products.isActive, true))

  // 去重
  const types = [...new Set(result.map(r => r.type).filter(Boolean))]

  return {
    success: true,
    data: types
  }
})
