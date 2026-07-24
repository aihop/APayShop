import { webhooks, settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'

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
  return { ok: false }
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
        const body = JSON.stringify(rawPayload)

        console.log(`[EventBus] Dispatching ${eventName} to ${webhook.name} (${webhook.url})`)
        console.log('[EventBus] Payload:', JSON.stringify(rawPayload, null, 2))

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Apay-Event': eventName,
          'X-Apay-Timestamp': timestamp
        }

        // If integration token is configured, use it as Bearer auth
        if (webhook.token) {
          headers['Authorization'] = `Bearer ${webhook.token}`
        }

        console.log('[EventBus] Headers:', JSON.stringify(headers, null, 2))

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          // Set a timeout so misbehaving webhooks don't hang connections
          signal: AbortSignal.timeout(5000) 
        })

        if (!response.ok) {
          console.warn(`[EventBus] Webhook delivery failed for ${webhook.name} (${webhook.url}). Status: ${response.status}`)
        } else {
          console.log(`[EventBus] Successfully delivered ${eventName} to ${webhook.name}`)
        }
      } catch (err: any) {
        console.error(`[EventBus] Webhook delivery error for ${webhook.name} (${webhook.url}):`, err.message)
      }
    }))
  } catch (error) {
    console.error(`[EventBus] Failed to process event ${eventName}:`, error)
  }
}