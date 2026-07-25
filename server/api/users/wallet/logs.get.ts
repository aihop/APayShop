import { listBalanceLogs, type BalanceType } from '../../../utils/balance'
import { getRequestLocale } from '../../../utils/requestLocale'

/**
 * 钱包流水分页。数据源是 balance_logs（余额变更的权威记录），
 * 不是订单表——订单只代表「付了多少钱」，流水才代表「余额怎么变的」。
 */
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const query = getQuery(event)
  const balanceType = String(query.balanceType || '')
  const result = await listBalanceLogs({
    userId: Number(session.user.id),
    page: Number(query.page || 1),
    pageSize: Number(query.pageSize || 20),
    balanceType: (balanceType === 'cash' || balanceType === 'grant' ? balanceType : '') as BalanceType | '',
    actionType: String(query.actionType || ''),
  })

  return { code: 0, data: result }
})
