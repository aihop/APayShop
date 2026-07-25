import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/runtime'
import { balanceLogs, users } from '../db/schema'

/**
 * 余额入账/出账的唯一入口。
 *
 * 口径：users.CashBalance / GrantBalance 与 balance_logs.amount_cents 都是**放大 10^8 的整数**。
 * 业务侧传的是记账币种金额（如 12.5），换算只在本文件做（toScaled/fromScaled），
 * 其它地方一律不要自己乘除 1e8。
 *
 * 幂等 —— 本文件最重要的部分：
 *   同一 eventId 只入账一次。支付回调会重试、用户也可能重复点，没有这道锁就会重复加钱。
 *   实现顺序是「**先写流水抢占 eventId，再改余额**」，不能反过来：
 *     - 先写流水后改余额：中途崩溃 = 有流水没加钱，重试会被幂等键挡住 → 少加钱，但有据可查、能人工补
 *     - 先改余额后写流水：中途崩溃 = 加了钱没凭据，重试没有幂等键可挡 → **重复加钱**
 *   仓库里没有事务可用（apay 支持 D1，那边不支持交互式事务），所以只能靠这个顺序把
 *   失败模式压到「宁可少加，不可多加」这一侧。
 *
 * 并发：余额更新用 `balance = balance + delta` 的相对写法（数据库内原子），
 * 不做「读出来加一加再写回」——后者在并发下会丢更新。
 * 流水里的 before/after 是写入时刻的快照，只作展示，不参与任何计算。
 */

/** 记账放大倍数，与 users 表注释一致 */
export const BALANCE_SCALE = 100_000_000

export type BalanceType = 'cash' | 'grant'

export interface BalanceChangeInput {
  userId: number
  /** 变更哪个池；充值走 cash，赠送/订阅额度走 grant */
  balanceType: BalanceType
  /** 记账币种金额（正数）。方向由 direction 决定，不要传负数 */
  amount: number
  direction?: 'credit' | 'debit'
  /** 幂等键，必填。建议格式：topup:<orderId> / admin:<adminId>:<ts> / refund:<orderId> */
  eventId: string
  actionType?: string
  sourceType?: 'order' | 'admin' | 'system'
  sourceId?: string | null
  operatorAdminId?: number | null
  operatorName?: string
  remark?: string
}

export interface BalanceChangeResult {
  /** false = 该 eventId 之前已入过账，本次未重复变更 */
  applied: boolean
  balanceType: BalanceType
  /** 变更后的余额（记账币种） */
  balance: number
}

export const toScaled = (amount: number): number => Math.round(Number(amount || 0) * BALANCE_SCALE)
export const fromScaled = (scaled: bigint | number | string | null | undefined): number =>
  Number(scaled || 0) / BALANCE_SCALE

/** 读取用户某一池余额（记账币种） */
export async function getUserBalance(userId: number, balanceType: BalanceType): Promise<number> {
  const rows = await db.select({ cash: users.CashBalance, grant: users.GrantBalance })
    .from(users).where(eq(users.id, userId)).limit(1)
  if (rows.length === 0) return 0
  return fromScaled(balanceType === 'grant' ? rows[0].grant : rows[0].cash)
}

const isDuplicateKeyError = (error: unknown) =>
  /duplicate|unique/i.test(String((error as any)?.message || ''))

/**
 * 变更余额并记一条流水。同一 eventId 重复调用只生效一次（applied=false）。
 *
 * 出账（debit）不做余额下限校验：这里只负责把变更做掉，够不够扣由调用方在业务层判断。
 */
export async function changeBalance(input: BalanceChangeInput): Promise<BalanceChangeResult> {
  const direction = input.direction || 'credit'
  const amount = Math.abs(Number(input.amount || 0))
  if (!input.userId || !input.eventId) {
    throw new Error('changeBalance requires userId and eventId')
  }
  if (!(amount > 0)) {
    throw new Error('changeBalance requires a positive amount')
  }

  const balanceType = input.balanceType
  const scaled = toScaled(amount)
  const delta = direction === 'debit' ? -scaled : scaled
  const before = await getUserBalance(input.userId, balanceType)

  // 1) 先抢占幂等键：唯一键冲突即表示这笔已经入过账（或正在被并发处理），直接返回
  try {
    await db.insert(balanceLogs).values({
      userId: input.userId,
      balanceType,
      actionType: input.actionType || (direction === 'debit' ? 'consume' : 'topup'),
      amountCents: delta,
      beforeBalanceCents: toScaled(before),
      afterBalanceCents: toScaled(before) + delta,
      eventId: input.eventId,
      sourceType: input.sourceType || 'system',
      sourceId: input.sourceId || null,
      operatorAdminId: input.operatorAdminId ?? null,
      operatorName: input.operatorName || '',
      remark: input.remark || '',
      createdAt: new Date(),
    } as any)
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { applied: false, balanceType, balance: before }
    }
    throw error
  }

  // 2) 再改余额（相对写法，数据库内原子）
  if (balanceType === 'grant') {
    await db.update(users)
      .set({ GrantBalance: sql`${users.GrantBalance} + ${delta}` as any })
      .where(eq(users.id, input.userId))
  } else {
    await db.update(users)
      .set({ CashBalance: sql`${users.CashBalance} + ${delta}` as any })
      .where(eq(users.id, input.userId))
  }

  return { applied: true, balanceType, balance: await getUserBalance(input.userId, balanceType) }
}

/** 入账便捷封装 */
export const creditBalance = (input: Omit<BalanceChangeInput, 'direction'>) =>
  changeBalance({ ...input, direction: 'credit' })

/** 出账便捷封装 */
export const debitBalance = (input: Omit<BalanceChangeInput, 'direction'>) =>
  changeBalance({ ...input, direction: 'debit' })

/** 充值退款回收的标准幂等键：一笔订单只可能回收一次 */
export const refundEventId = (orderId: string) => `refund:${orderId}`

export interface ClawbackResult {
  applied: boolean
  /** 实际回收金额（可能小于应回收，见 shortfall） */
  clawedBack: number
  /** 未能回收的部分：用户余额已花掉，不足以扣回 */
  shortfall: number
  balance: number
}

/**
 * 充值退款时回收已入账的余额。
 *
 * 两条业务约束：
 *  1. **只回收确实入过账的订单**：没有对应的 topup 流水（例如订单从未履约就被标退款）
 *     就什么都不做，否则会凭空扣用户的钱。
 *  2. **余额不足时只扣到 0，不制造负数**：apay 全链路（钱包展示、余额判断）都假设
 *     余额非负，引入负数会波及每一处读取。扣不回来的部分记在 shortfall 里并写进流水备注，
 *     由人工跟进（用户已经把钱花掉了，这是业务纠纷不是数据问题）。
 */
export async function clawbackTopup(input: {
  userId: number
  orderId: string
  operatorAdminId?: number | null
  operatorName?: string
  remark?: string
}): Promise<ClawbackResult> {
  const balanceType: BalanceType = 'cash'

  // 找到原始入账流水：金额与余额池都以它为准，不重新读订单（订单金额可能被改过）
  const credited = await db.select({
    amountCents: balanceLogs.amountCents,
    balanceType: balanceLogs.balanceType,
  }).from(balanceLogs).where(eq(balanceLogs.eventId, topupEventId(input.orderId))).limit(1)

  if (credited.length === 0) {
    return { applied: false, clawedBack: 0, shortfall: 0, balance: await getUserBalance(input.userId, balanceType) }
  }

  const creditedType = (credited[0]!.balanceType === 'grant' ? 'grant' : 'cash') as BalanceType
  const creditedAmount = fromScaled(credited[0]!.amountCents as any)
  const current = await getUserBalance(input.userId, creditedType)
  const clawedBack = Math.min(creditedAmount, Math.max(0, current))
  const shortfall = Math.round((creditedAmount - clawedBack) * BALANCE_SCALE) / BALANCE_SCALE

  if (!(clawedBack > 0)) {
    // 余额已清零：没有可回收的钱，但仍要让调用方知道缺口
    return { applied: false, clawedBack: 0, shortfall: creditedAmount, balance: current }
  }

  const remarkParts = [input.remark || `充值退款回收 ${input.orderId}`]
  if (shortfall > 0) remarkParts.push(`余额不足，未回收 ${shortfall}`)

  const result = await changeBalance({
    userId: input.userId,
    balanceType: creditedType,
    amount: clawedBack,
    direction: 'debit',
    eventId: refundEventId(input.orderId),
    actionType: 'refund',
    sourceType: 'order',
    sourceId: input.orderId,
    operatorAdminId: input.operatorAdminId ?? null,
    operatorName: input.operatorName || '',
    remark: remarkParts.join('；'),
  })

  return { applied: result.applied, clawedBack: result.applied ? clawedBack : 0, shortfall, balance: result.balance }
}

/** 充值到账的标准幂等键：一笔订单只可能到账一次 */
export const topupEventId = (orderId: string) => `topup:${orderId}`

export interface BalanceLogQuery {
  userId: number
  page?: number
  pageSize?: number
  balanceType?: BalanceType | ''
  actionType?: string
}

/** 分页读取用户流水（钱包页用） */
export async function listBalanceLogs(query: BalanceLogQuery) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))

  const conditions = [eq(balanceLogs.userId, query.userId)]
  if (query.balanceType) conditions.push(eq(balanceLogs.balanceType, query.balanceType))
  if (query.actionType) conditions.push(eq(balanceLogs.actionType, query.actionType))
  const where = conditions.length > 1 ? and(...conditions) : conditions[0]

  const [rows, totalRows] = await Promise.all([
    db.select().from(balanceLogs).where(where)
      .orderBy(sql`${balanceLogs.createdAt} desc`, sql`${balanceLogs.id} desc`)
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(balanceLogs).where(where),
  ])

  return {
    page,
    pageSize,
    total: Number(totalRows[0]?.count || 0),
    list: rows.map((row: any) => ({
      id: Number(row.id),
      balanceType: row.balanceType,
      actionType: row.actionType,
      amount: fromScaled(row.amountCents),
      beforeBalance: fromScaled(row.beforeBalanceCents),
      afterBalance: fromScaled(row.afterBalanceCents),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      operatorName: row.operatorName,
      remark: row.remark,
      createdAt: row.createdAt,
    })),
  }
}
