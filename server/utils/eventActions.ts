import { and, eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { eventRules } from '../db/schema'
import { dispatchEvent, sendHttpWebhook } from './eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from './externalProxy'

/**
 * 事件自动化:把"事件 → 动作(带参数)"做成后台可配置的规则。
 *
 * - `dispatchEvent`(eventBus):把事件转发给外部 webhook 订阅者(保留)。
 * - `runEventActions`(本文件):执行后台配置的"内部动作"(如发奖励)。
 * - `emitEvent` = 两者合一,业务侧统一调用它。
 *
 * 发奖励复用 ainode 的 `transaction.credit` 入账,幂等 eventId = reward:<event>:<ruleId>:<userId>,
 * ainode 按 event_id 去重 → 同一用户同一规则永不重复发(防重复注册/重试)。
 */

interface EventPayload {
  userId?: number
  id?: number
  [k: string]: any
}

function extractUserId(payload: EventPayload): number {
  return Number(payload?.userId ?? payload?.id ?? 0) || 0
}

async function grantReward(rule: any, payload: EventPayload) {
  const config = rule.config || {}
  const userId = extractUserId(payload)
  const amount = Number(config?.amount || 0)
  const balanceType = String(config?.balanceType || 'points').toLowerCase()

  if (userId <= 0 || amount <= 0) {
    console.warn(`[EventActions] grant_reward skipped (rule ${rule.id}): userId=${userId} amount=${amount}`)
    return
  }
  if (!['points', 'cash', 'grant'].includes(balanceType)) {
    console.warn(`[EventActions] grant_reward skipped (rule ${rule.id}): bad balanceType ${balanceType}`)
    return
  }

  const [webhookUrl, token] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
  if (!webhookUrl || !token) {
    console.error('[EventActions] grant_reward: ainode webhook URL / integration token not configured')
    return
  }

  // 幂等键:同一规则 + 同一用户 唯一。ainode 按 event_id 去重。
  const eventId = `reward:${rule.event}:${rule.id}:${userId}`

  const res = await sendHttpWebhook(
    webhookUrl,
    {
      event: 'transaction.credit',
      timestamp: new Date().toISOString(),
      data: {
        source: 'apayshop',
        eventId,
        userId,
        type: String(config?.type || 'reward'),
        // points 时 amount = 积分数;cash/grant 时 amount = 金额(元)。ainode 按 balanceType 换算。
        balanceType,
        direction: 'credit',
        amount,
        sourceId: eventId,
        remark: String(config?.remark || rule.remark || '事件奖励'),
      },
    },
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (res.ok) {
    console.log(`[EventActions] reward granted: ${amount} ${balanceType} → user ${userId} (rule ${rule.id})`)
  } else {
    console.error(`[EventActions] reward failed: user ${userId} (rule ${rule.id}, eventId ${eventId})`)
  }
}

async function runAction(rule: any, payload: EventPayload) {
  switch (rule.action) {
    case 'grant_reward':
      await grantReward(rule, payload)
      break
    default:
      console.warn(`[EventActions] unknown action "${rule.action}" (rule ${rule.id})`)
  }
}

/**
 * 执行某事件下所有启用的内部动作规则。失败不抛出(不阻塞主流程)。
 */
export async function runEventActions(event: string, payload: EventPayload) {
  let rules: any[] = []
  try {
    rules = await db
      .select()
      .from(eventRules)
      .where(and(eq(eventRules.event, event), eq(eventRules.enabled, true)))
  } catch (e) {
    console.error(`[EventActions] failed to load rules for ${event}:`, e)
    return
  }

  for (const rule of rules) {
    try {
      await runAction(rule, payload)
    } catch (e) {
      console.error(`[EventActions] action "${rule.action}" for ${event} failed:`, e)
    }
  }
}

/**
 * 统一事件入口:外发 webhook(dispatchEvent)+ 执行内部动作(runEventActions)。
 * 业务侧用它替代直接调 dispatchEvent。
 */
export async function emitEvent(event: string, payload: EventPayload) {
  try {
    await dispatchEvent(event, payload)
  } catch (e) {
    console.error(`[EventActions] dispatchEvent ${event} failed:`, e)
  }
  await runEventActions(event, payload)
}
