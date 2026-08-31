import { defineEventHandler, readRawBody, getHeader } from 'h3'
import { verifyWebhookHmac } from '../../../server/crypto/hmac'
import { processApayWebhookEvent } from '../../../server/entitlements/events'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    const rawBody = await readRawBody(event, 'utf8')
    if (!rawBody) {
      throw Errors.badRequest('Empty body')
    }

    const signature = getHeader(event, 'x-apay-signature') || getHeader(event, 'x-hub-signature-256') || ''
    const integrationToken = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') || ''

    // 验签：HMAC 或 Bearer Token
    const isHmacValid = signature ? verifyWebhookHmac(rawBody, signature) : false
    const isTokenValid = integrationToken && (integrationToken === process.env.APAY_INTEGRATION_TOKEN || integrationToken === process.env.GORAY_WEBHOOK_SECRET)

    if (!isHmacValid && !isTokenValid) {
      throw Errors.unauthorized('Invalid webhook signature or integration token')
    }

    const payload = JSON.parse(rawBody)
    const result = await processApayWebhookEvent(payload, rawBody)

    return successResponse(result, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
