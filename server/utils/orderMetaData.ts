/**
 * 订单 metaData 的受信边界。
 *
 * 背景(2026-07 安全修复):order.metaData 会被 fulfillment.buildOrderIntegration
 * 读取,用于拼出发给 ainode 的 integration.transaction(入账类型/余额池/金额)。
 * 该函数里订单级配置优先于商品级,而下单接口此前把客户端 metaData 最后展开,
 * 等于让买家自己决定到账多少——付 1 块、带上 { balance_type:'cash',
 * recharge_amount: 999999 } 就能让任意商品变成一笔巨额充值。
 *
 * 因此这几个键一律由服务端计算后写入,客户端传什么都丢弃。新增会影响记账的
 * 字段时,必须同步加进 RESERVED_ORDER_META_KEYS。
 */
export const RESERVED_ORDER_META_KEYS = [
  'recharge_amount',
  'balance_type',
  'integration',
  'plan_ids',
  'currencySnapshot',
  'checkoutBridge',
  'display_unit',
] as const

/** 剔除客户端不得自定义的记账字段(浅层即可:integration 整棵子树被整体丢弃) */
export function stripReservedOrderMeta(
  input: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const output: Record<string, any> = {}
  for (const [key, value] of Object.entries(input)) {
    if ((RESERVED_ORDER_META_KEYS as readonly string[]).includes(key)) continue
    output[key] = value
  }
  return output
}
