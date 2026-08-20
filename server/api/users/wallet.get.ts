import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '../../db/runtime'
import { balanceLogs, topups, userWallets } from '../../db/schema'
import { fromScaled } from '../../utils/balance'
import { getRequestLocale } from '../../utils/requestLocale'
import { getTopupRules } from '../../utils/topup'
import { getOrCreateUserWallet } from '../../utils/userWallet'
import { TOPUP_STATUS } from '../../utils/topupLedger'

/**
 * 钱包概览：余额（cash / grant）、近 30 天充值与支出、待支付的充值单。
 *
 * 「近 30 天充值」以 topups 的已到账记录为准；订单记录实付，balance_logs 记录
 * 所有资金变动，只有 topups 能区分充值、后台调账与退款状态。
 */
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }
  const userId = Number(session.user.id)
  const wallet = await getOrCreateUserWallet(userId)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [rules, userRows, creditRows, debitRows, pendingRows] = await Promise.all([
    // 记账币种由钱包接口自己给出:余额的计价单位是钱包自身的属性,
    // 让前端去问「充值配置」要币种,会在充值被关闭时退化成默认 USD,
    // 把人民币余额标上美元符号。
    getTopupRules(),
    db.select({ cash: userWallets.cashBalance, grant: userWallets.grantBalance })
      .from(userWallets).where(eq(userWallets.id, wallet.id)).limit(1),
    db.select({ total: sql<number>`coalesce(sum(${topups.creditAmountCents}), 0)`, count: sql<number>`count(*)` })
      .from(topups)
      .where(and(
        eq(topups.walletId, wallet.id),
        eq(topups.status, TOPUP_STATUS.CREDITED),
        gte(topups.creditedAt, since),
      )),
    // 近 30 天出账（amount_cents < 0）
    db.select({ total: sql<number>`coalesce(sum(${balanceLogs.amountCents}), 0)` })
      .from(balanceLogs)
      .where(and(
        eq(balanceLogs.walletId, wallet.id),
        gte(balanceLogs.createdAt, since),
        sql`${balanceLogs.amountCents} < 0`,
      )),
    db.select({
      orderId: topups.orderId,
      amount: topups.paymentAmount,
      currency: topups.paymentCurrency,
      rechargeAmountCents: topups.creditAmountCents,
      createdAt: topups.createdAt,
    }).from(topups)
      .where(and(
        eq(topups.userId, userId),
        eq(topups.status, TOPUP_STATUS.PENDING),
      )),
  ])

  const cash = fromScaled(userRows[0]?.cash as any)
  const grant = fromScaled(userRows[0]?.grant as any)

  const pendingTopups = pendingRows.map((row: any) => ({
    orderId: String(row.orderId),
    amount: Number(row.amount || 0),
    currency: String(row.currency || 'USD'),
    rechargeAmount: fromScaled(row.rechargeAmountCents),
    createdAt: row.createdAt,
  }))

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
