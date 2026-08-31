import { H3Event } from 'h3'
import { Errors } from './errors'

export interface ApayUserBrief {
  id: number
  email: string
  name?: string
}

export interface GorayProductMeta {
  service: 'goray'
  plan_code: string
  plan_level: number
  device_limit: number
  traffic_bytes: number
  trial?: boolean
  is_pricing_plan?: boolean
  duration_days?: number
}

/**
 * 校验当前 Web 会话中的 APay 用户（基于 Cookie Session）
 */
export const requireApayWebUser = async (event: H3Event): Promise<ApayUserBrief> => {
  // @ts-ignore - nuxt-auth-utils injected server helper
  const session = await getUserSession(event)
  if (!session || !session.user || !session.user.id) {
    throw Errors.unauthorized('Please log in to continue')
  }

  return {
    id: Number(session.user.id),
    email: session.user.email || '',
    name: session.user.name || session.user.username || '',
  }
}

/**
 * 获取当前 APay 管理员身份
 */
export const requireApayAdmin = async (event: H3Event): Promise<{ id: number; username: string; role?: string }> => {
  // @ts-ignore
  const session = await getUserSession(event)
  if (session?.user?.isAdmin || session?.admin) {
    return {
      id: Number(session.admin?.id || session.user?.id || 1),
      username: session.admin?.username || session.user?.username || 'admin',
      role: session.admin?.role || 'admin',
    }
  }

  // 或者检查 event.context.admin (由 APay 中间件注入)
  if (event.context.admin) {
    return event.context.admin
  }

  throw Errors.forbidden('Admin privileges required')
}

/**
 * 读取 APay Core 中属于 Goray 的商品 (service = 'goray')
 */
export const getGorayProducts = async () => {
  try {
    const { db } = await import('../../../../../server/db/runtime')
    const { products } = await import('../../../../../server/db/schema')
    const { eq, desc } = await import('drizzle-orm')

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.sortOrder), desc(products.id))

    // 过滤出 metaData.service === 'goray' 的商品
    return rows.filter((p: any) => {
      try {
        const meta = typeof p.metaData === 'string' ? JSON.parse(p.metaData) : p.metaData
        return meta && meta.service === 'goray'
      } catch {
        return false
      }
    })
  } catch (err) {
    console.warn('[goray-core-adapter] Failed to query products from core db:', err)
    return []
  }
}

/**
 * 根据 APay User ID 批量获取用户概要展示信息
 */
export const getApayUserBriefs = async (userIds: number[]): Promise<Map<number, ApayUserBrief>> => {
  const map = new Map<number, ApayUserBrief>()
  if (userIds.length === 0) return map

  try {
    const { db } = await import('../../../../../server/db/runtime')
    const { users } = await import('../../../../../server/db/schema')
    const { inArray } = await import('drizzle-orm')

    const rows = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds))

    for (const r of rows) {
      map.set(Number(r.id), {
        id: Number(r.id),
        email: r.email,
        name: r.username || '',
      })
    }
  } catch (err) {
    console.warn('[goray-core-adapter] Failed to query users from core db:', err)
  }

  return map
}
