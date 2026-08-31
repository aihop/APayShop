import { and, eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { eventRules } from '../db/schema'
import { dispatchEvent, sendHttpWebhook } from './eventBus'
import { getWebhookSubscriptionUrl, getIntegrationToken } from './externalProxy'
import { logger } from './logger'

/**
 * 事件自动化:把"事件 → 动作(带参数)"做成后台可配置的规则。
 *
 * - `dispatchEvent`(eventBus):把事件转发给外部 webhook 订阅者(保留)。
 * - `runEventActions`(本文件):执行后台配置的"内部动作"(如发奖励、外发 Webhook)。
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

interface ActionResult {
  ok: boolean
  status?: number
  errorMessage?: string
}

function extractUserId(payload: EventPayload): number {
  return Number(payload?.userId ?? payload?.id ?? 0) || 0
}

async function grantReward(rule: any, payload: EventPayload): Promise<ActionResult> {
  const config = rule.config || {}
  const isSync = config?.mode === 'sync'
  const userId = extractUserId(payload)
  const amount = Number(config?.amount || 0)
  const balanceType = String(config?.balanceType || 'points').toLowerCase()

  if (userId <= 0 || amount <= 0) {
    console.warn(`[EventActions] grant_reward skipped (rule ${rule.id}): userId=${userId} amount=${amount}`)
    return { ok: true }
  }
  if (!['points', 'cash', 'grant'].includes(balanceType)) {
    console.warn(`[EventActions] grant_reward skipped (rule ${rule.id}): bad balanceType ${balanceType}`)
    return { ok: true }
  }

  const [webhookUrl, token] = await Promise.all([getWebhookSubscriptionUrl(), getIntegrationToken()])
  if (!webhookUrl || !token) {
    const msg = 'ainode webhook URL / integration token not configured'
    console.error('[EventActions] grant_reward:', msg)
    return { ok: !isSync, errorMessage: msg }
  }

  // 幂等键:同一规则 + 同一用户 唯一。ainode 按 event_id 去重。
  const eventId = `reward:${rule.event}:${rule.id}:${userId}`

  const res = await sendHttpWebhook(
    webhookUrl,
    {
      event: 'transaction.credit',
      timestamp: new Date().toISOString(),
      data: {
        source: 'apay',
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
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: isSync ? 3000 : 8000,
      retries: isSync ? 0 : 2,
    },
  )

  if (res.ok) {
    console.log(`[EventActions] reward granted: ${amount} ${balanceType} → user ${userId} (rule ${rule.id})`)
    return { ok: true, status: res.status }
  } else {
    console.error(`[EventActions] reward failed: user ${userId} (rule ${rule.id}, eventId ${eventId})`)
    return { ok: false, status: res.status, errorMessage: '事件奖励发放请求失败' }
  }
}

async function sendWebhookAction(rule: any, payload: EventPayload): Promise<ActionResult> {
  const config = rule.config || {}
  const urlMode = config?.urlMode === 'custom' ? 'custom' : 'default'
  const isSync = config?.mode === 'sync'

  let targetUrl = ''
  let token = ''

  if (urlMode === 'custom') {
    targetUrl = String(config?.customUrl || '').trim()
    token = String(config?.customToken || '').trim()
    if (!token) {
      token = (await getIntegrationToken()) || ''
    }
  } else {
    const [globalWebhookUrl, globalToken] = await Promise.all([
      getWebhookSubscriptionUrl(),
      getIntegrationToken(),
    ])
    targetUrl = globalWebhookUrl || ''
    token = globalToken || ''
  }

  if (!targetUrl) {
    const msg = `Webhook 目标地址未配置 (模式: ${urlMode})`
    console.warn(`[EventActions] send_webhook skipped (rule ${rule.id}): ${msg}`)
    return { ok: !isSync, errorMessage: msg }
  }

  const timestamp = Date.now().toString()
  const rawPayload = {
    event: rule.event,
    timestamp,
    data: payload,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Apay-Event': rule.event,
    'X-Apay-Timestamp': timestamp,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  console.log(`[EventActions] Dispatching webhook (${isSync ? 'sync' : 'async'}) for rule ${rule.id} (${rule.event}) to ${targetUrl}`)

  const timeout = isSync ? 3000 : 5000
  let res = { ok: false, status: undefined as number | undefined, errorDetail: '' }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(rawPayload),
      signal: AbortSignal.timeout(timeout),
    })
    res.status = response.status
    if (response.ok) {
      res.ok = true
    } else {
      let bodyText = ''
      try {
        bodyText = await response.text()
        const parsed = JSON.parse(bodyText)
        res.errorDetail = parsed.message || parsed.error || parsed.statusMessage || bodyText
      } catch {
        res.errorDetail = bodyText || `HTTP ${response.status}`
      }
    }
  } catch (err: any) {
    res.errorDetail = err.message || (err.name === 'AbortError' ? '请求超时' : '网络连接失败')
  }

  if (res.ok) {
    console.log(`[EventActions] Webhook delivered successfully for rule ${rule.id} to ${targetUrl}`)
    return { ok: true, status: res.status }
  } else {
    const errMsg = res.errorDetail || `Webhook 回调失败 (HTTP ${res.status || 'timeout'})`
    console.warn(`[EventActions] Webhook delivery failed for rule ${rule.id} to ${targetUrl}. Error: ${errMsg}`)
    await logger.error(`Webhook delivery failed for rule ${rule.id}: ${rule.event} → ${targetUrl}`, {
      source: 'eventActions',
      details: {
        ruleId: rule.id,
        event: rule.event,
        url: targetUrl,
        status: res.status,
        error: errMsg,
        isSync,
      },
    }).catch(() => {})
    return { ok: false, status: res.status, errorMessage: errMsg }
  }
}

import { loadActiveThemeEventRules } from './themeEvents'

async function runAction(rule: any, payload: EventPayload): Promise<ActionResult> {
  const themeRules = await loadActiveThemeEventRules()
  const matchedTheme = themeRules.find(r => r.key === rule.action)
  if (matchedTheme) {
    try {
      const res = await matchedTheme.handler(payload)
      if (res && typeof res === 'object') return res
      return { ok: true }
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      return { ok: false, errorMessage: errMsg }
    }
  }

  switch (rule.action) {
    case 'grant_reward':
      return await grantReward(rule, payload)
    case 'send_webhook':
      return await sendWebhookAction(rule, payload)
    default:
      console.warn(`[EventActions] unknown action "${rule.action}" (rule ${rule.id})`)
      return { ok: true }
  }
}

/**
 * 执行某事件下所有启用的内部动作规则。
 * modeFilter: 'sync' (同步规则，失败抛出中断) | 'async' (异步规则，失败不抛出)
 */
export async function runEventActions(event: string, payload: EventPayload, modeFilter?: 'sync' | 'async') {
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

  if (modeFilter) {
    rules = rules.filter(r => (r.config?.mode === 'sync' ? 'sync' : 'async') === modeFilter)
  }

  for (const rule of rules) {
    const isSync = rule.config?.mode === 'sync'
    try {
      const result = await runAction(rule, payload)
      if (isSync && !result.ok) {
        throw createError({
          statusCode: 422,
          statusMessage: result.errorMessage || `事件同步动作执行失败 (${rule.remark || rule.action})`,
        })
      }
    } catch (e: any) {
      if (isSync) {
        // 同步模式向外抛出错误，用于主流程拦截
        throw e
      }
      console.error(`[EventActions] action "${rule.action}" for ${event} failed:`, e)
    }
  }
}

/**
 * 统一事件入口:
 * 1. 同步执行所有内置同步主题动作与 mode === 'sync' 的内部动作规则，一旦失败抛出异常中断主流程；
 * 2. 异步后台执行所有主题内置异步动作、mode !== 'sync' 的自定义规则与外部全局 webhook 广播（安全隔离）。
 */
export async function emitEvent(event: string, payload: EventPayload) {
  const themeRules = await loadActiveThemeEventRules()

  // 1. 同步拦截阶段
  const syncThemeRules = themeRules.filter(r => r.event === event && r.mode === 'sync')
  for (const rule of syncThemeRules) {
    try {
      const res = await rule.handler(payload)
      if (res && typeof res === 'object' && res.ok === false) {
        throw createError({
          statusCode: 422,
          statusMessage: res.errorMessage || `主题内置动作执行失败 (${rule.label})`,
        })
      }
    } catch (err) {
      console.error(`[ThemeRule] sync ${rule.key} for ${event} failed:`, err)
      throw err
    }
  }

  await runEventActions(event, payload, 'sync')

  // 2. 异步非阻塞阶段
  const asyncTask = async () => {
    try {
      await dispatchEvent(event, payload)
    } catch (e) {
      console.error(`[EventActions] dispatchEvent ${event} failed:`, e)
    }

    // 执行主题注册的异步内置动作
    const asyncThemeRules = themeRules.filter(r => r.event === event && r.mode !== 'sync')
    for (const rule of asyncThemeRules) {
      try {
        const res = await rule.handler(payload)
        if (res && typeof res === 'object' && res.ok === false) {
          console.warn(`[ThemeRule] async ${rule.key} reported error:`, res.errorMessage)
        }
      } catch (err) {
        console.error(`[ThemeRule] async ${rule.key} for ${event} failed:`, err)
      }
    }

    try {
      await runEventActions(event, payload, 'async')
    } catch (e) {
      console.error(`[EventActions] runEventActions(async) ${event} failed:`, e)
    }
  }

  void asyncTask()
}
