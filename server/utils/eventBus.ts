import { webhooks, settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@nuxthub/db'

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
    const globalWebhookSecretSetting = await db.select().from(settings).where(eq(settings.key, 'webhook_secret')).limit(1)

    const globalWebhookUrl = globalWebhookUrlSetting[0]?.value
    const globalWebhookSecret = globalWebhookSecretSetting[0]?.value

    if (globalWebhookUrl) {
      subscribers.push({
        name: 'Global Webhook',
        url: globalWebhookUrl,
        secret: globalWebhookSecret,
        events: ['*'] // Global webhook receives all events
      })
    }

    if (subscribers.length === 0) {
      console.log(`[EventBus] No subscribers for event: ${eventName}`)
      return
    }

    const timestamp = Date.now().toString()
    
    // Dispatch to all subscribers asynchronously
    // We don't await Promise.all here because we don't want webhook failures to block the main thread
    subscribers.forEach(async (webhook: any) => {
      try {
        const body = JSON.stringify({
          event: eventName,
          timestamp,
          data: payload
        })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-APayShop-Event': eventName,
          'X-APayShop-Timestamp': timestamp
        }

        // If secret is configured, compute HMAC signature for verification
        if (webhook.secret) {
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(`${timestamp}.${body}`)
            .digest('hex')
          headers['X-APayShop-Signature'] = signature
        }

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
    })
  } catch (error) {
    console.error(`[EventBus] Failed to process event ${eventName}:`, error)
  }
}