import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { balanceLogs, orders, users } from '../../db/schema'
import { fromScaled } from '../../utils/balance'
import { getRequestLocale } from '../../utils/requestLocale'
import { ORDER_PAY_STATUS } from '../../utils/constants'
import { getTopupRules } from '../../utils/topup'

/**
 * 钱包概览：余额（cash / grant）、近 30 天充值与支出、待支付的充值单。
 *
 * 「近 30 天充值」以 balance_logs 为准而不是订单金额——订单记的是实付原币
 * （可能是 CNY），余额是记账币种，两者不能直接相加；流水里的 amount 已经是记账币种。
 */
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }
  const userId = Number(session.user.id)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [rules, userRows, creditRows, debitRows, pendingRows] = await Promise.all([
    // 记账币种由钱包接口自己给出:余额的计价单位是钱包自身的属性,
    // 让前端去问「充值配置」要币种,会在充值被关闭时退化成默认 USD,
    // 把人民币余额标上美元符号。
    getTopupRules(),
    db.select({ cash: users.CashBalance, grant: users.GrantBalance })
      .from(users).where(eq(users.id, userId)).limit(1),
    // 近 30 天入账（amount_cents > 0）
    db.select({ total: sql<number>`coalesce(sum(${balanceLogs.amountCents}), 0)`, count: sql<number>`count(*)` })
      .from(balanceLogs)
      .where(and(
        eq(balanceLogs.userId, userId),
        gte(balanceLogs.createdAt, since),
        sql`${balanceLogs.amountCents} > 0`,
      )),
    // 近 30 天出账（amount_cents < 0）
    db.select({ total: sql<number>`coalesce(sum(${balanceLogs.amountCents}), 0)` })
      .from(balanceLogs)
      .where(and(
        eq(balanceLogs.userId, userId),
        gte(balanceLogs.createdAt, since),
        sql`${balanceLogs.amountCents} < 0`,
      )),
    // 待支付的充值单：载体 SKU 上的未支付订单
    db.select({ id: orders.id, amount: orders.amount, currency: orders.currency, createdAt: orders.createdAt, metaData: orders.metaData })
      .from(orders)
      .where(and(
        eq(orders.userId, userId),
        eq(orders.payStatus, ORDER_PAY_STATUS.PENDING),
      )),
  ])

  const cash = fromScaled(userRows[0]?.cash as any)
  const grant = fromScaled(userRows[0]?.grant as any)

  // 只保留快捷充值产生的待支付单（其它商品订单不属于钱包范畴）
  const pendingTopups = pendingRows
    .filter((row: any) => {
      const meta = typeof row.metaData === 'string' ? safeParse(row.metaData) : (row.metaData || {})
      // 快捷充值订单的标志是服务端写入的 recharge_amount（见 api/orders/topup.post.ts），
      // 普通商品订单没有这个字段，自然被排除
      return Number(meta?.recharge_amount || 0) > 0
    })
    .map((row: any) => {
      const meta = typeof row.metaData === 'string' ? safeParse(row.metaData) : (row.metaData || {})
      return {
        orderId: String(row.id),
        amount: Number(row.amount || 0),
        currency: String(row.currency || 'USD'),
        rechargeAmount: Number(meta?.recharge_amount || 0),
        createdAt: row.createdAt,
      }
    })

  return {
    code: 0,
    data: {
      accountingCurrency: rules.accountingCurrency,
      topupEnabled: rules.enabled,
      cashBalance: cash,
      grantBalance: grant,
      availableBalance: cash + grant,
      monthlyRecharge: fromScaled(creditRows[0]?.total as any),
      monthlyRechargeCount: Number(creditRows[0]?.count || 0),
      // 出账在流水里是负数，对外给正数更符合「支出」的直觉
      monthlySpend: Math.abs(fromScaled(debitRows[0]?.total as any)),
      pendingRechargeCount: pendingTopups.length,
      pendingRechargeAmount: pendingTopups.reduce((sum: number, item: { rechargeAmount: number }) => sum + item.rechargeAmount, 0),
      pendingTopups,
    },
  }
})

function safeParse(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
