import { webhooks, settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { logger } from './logger'

/**
 * Low-level HTTP webhook sender with exponential backoff retry.
 *
 * Retry policy:
 * - 4xx: no retry (client error, fix the payload/URL)
 * - 5xx / network error: retry up to 3 times with backoff (1s → 2s → 4s)
 * - Returns { ok: true, status } on success, { ok: false, status? } on failure
 */
export async function sendHttpWebhook(
  url: string,
  body: object,
  options?: { headers?: Record<string, string>; retries?: number; timeout?: number }
): Promise<{ ok: boolean; status?: number }> {
  const maxRetries = options?.retries ?? 3
  const timeout = options?.timeout ?? 8000
  const bodyStr = JSON.stringify(body)
  // 记住最后一次的 HTTP 状态,重试耗尽后一并返回——否则调用方只知道"失败了",
  // 落到系统日志里就是 status: undefined,排查时看不出是 5xx 还是网络不通。
  let lastStatus: number | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(timeout),
      })

      if (response.ok) {
        console.log(`[EventBus] HTTP 200 POST ${url}`)
        return { ok: true, status: response.status }
      }

      // 4xx: client error, not worth retrying
      if (response.status >= 400 && response.status < 500) {
        console.warn(`[EventBus] 4xx POST ${url} (${response.status}), not retrying`)
        return { ok: false, status: response.status }
      }

      // 5xx: retry
      lastStatus = response.status
      console.warn(`[EventBus] 5xx POST ${url} (${response.status}), attempt ${attempt + 1}/${maxRetries}`)
      if (attempt < maxRetries) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 10000))
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[EventBus] Timeout POST ${url}, attempt ${attempt + 1}/${maxRetries}`)
      } else {
        console.warn(`[EventBus] Error POST ${url} (${err.message}), attempt ${attempt + 1}/${maxRetries}`)
      }
      if (attempt < maxRetries) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 10000))
      }
    }
  }

  console.error(`[EventBus] All ${maxRetries} retries exhausted for POST ${url}`)
  return { ok: false, status: lastStatus }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Legacy: dispatch event to DB-configured webhooks (order.paid, user.registered)
// ---------------------------------------------------------------------------

/**
 * Dispatch an event to all active webhooks subscribed to it
 * @param eventName The name of the event (e.g., 'order.paid')
 * @param payload The data to send with the event
 */
export async function dispatchEvent(eventName: string, payload: any) {
  try {
    const activeWebhooks = await db.select().from(webhooks).where(eq(webhooks.isActive, true))
    
    // Filter webhooks that subscribe to this event
    // In a production system, you might want to query this directly via JSON functions if supported,
    // but filtering in memory is fine for typical small-to-medium datasets.
    const subscribers = activeWebhooks.filter((wh: any) => 
      wh.events && Array.isArray(wh.events) && wh.events.includes(eventName)
    )

    // Check for global webhook in settings
    const globalWebhookUrlSetting = await db.select().from(settings).where(eq(settings.key, 'webhook_url')).limit(1)
    const integrationTokenSetting = await db.select().from(settings).where(eq(settings.key, 'integration_token')).limit(1)

    const globalWebhookUrl = globalWebhookUrlSetting[0]?.value
    const integrationToken = integrationTokenSetting[0]?.value

    if (globalWebhookUrl) {
      subscribers.push({
        name: 'Global Webhook',
        url: globalWebhookUrl,
        token: integrationToken,
        events: ['*'] // Global webhook receives all events
      })
    }

    if (subscribers.length === 0) {
      console.log(`[EventBus] No subscribers for event: ${eventName}`)
      return
    }

    const timestamp = Date.now().toString()
    
    // 逐个投递并整体等待:Serverless 运行时在响应返回后即可能被回收,
    // fire-and-forget 会永久丢投递(order.paid 等关键事件)。allSettled
    // 保证单个订阅方失败不影响其它投递,也不向调用方抛错。
    await Promise.allSettled(subscribers.map(async (webhook: any) => {
      try {
        const rawPayload = {
          event: eventName,
          timestamp,
          data: payload
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Apay-Event': eventName,
          'X-Apay-Timestamp': timestamp
        }

        // If integration token is configured, use it as Bearer auth
        if (webhook.token) {
          headers['Authorization'] = `Bearer ${webhook.token}`
        }

        console.log(`[EventBus] Dispatching ${eventName} to ${webhook.name} (${webhook.url})`)
        console.log('[EventBus] Payload:', JSON.stringify(rawPayload, null, 2))
        // 只打印头名,不打印值:Authorization 里是集成 token,原样输出等于把长期
        // 凭据写进 stdout / 日志归集 / 工单截图。
        console.log('[EventBus] Headers:', Object.keys(headers).join(', '))

        // 走带重试的 sendHttpWebhook,而不是裸 fetch:接收方 5xx(重启、部署、
        // 偶发故障)在这里是很常见的,单发一次失败就等于永久丢事件——order.paid
        // 丢掉意味着用户付了钱但下游余额/权益不到账,且没有任何补偿路径。
        const result = await sendHttpWebhook(webhook.url, rawPayload, {
          headers,
          retries: 3,
          timeout: 8000,
        })

        if (!result.ok) {
          console.warn(`[EventBus] Webhook delivery failed for ${webhook.name} (${webhook.url}). Status: ${result.status}`)
          // 同时落系统日志:只写 stdout 的话,丢掉的事件在后台完全看不见,
          // 事后根本无从得知哪些订单没通知到下游。
          await logger.error(`Webhook delivery failed: ${eventName} → ${webhook.name}`, {
            source: 'eventbus',
            details: {
              event: eventName,
              url: webhook.url,
              status: result.status,
              orderId: (payload as any)?.id,
            },
          })
        } else {
          console.log(`[EventBus] Successfully delivered ${eventName} to ${webhook.name}`)
        }
      } catch (err: any) {
        console.error(`[EventBus] Webhook delivery error for ${webhook.name} (${webhook.url}):`, err.message)
        await logger.error(`Webhook delivery error: ${eventName} → ${webhook.name}`, {
          source: 'eventbus',
          details: { event: eventName, url: webhook.url, message: err?.message, orderId: (payload as any)?.id },
        }).catch(() => {})
      }
    }))
  } catch (error) {
    console.error(`[EventBus] Failed to process event ${eventName}:`, error)
  }
}