import { z } from 'zod'
import {
  saveMinimalCheckoutAdminConfig,
  upsertMinimalCheckoutSecret,
} from '../../../../../app/themes/minimal/server/checkout/bridge'

const bodySchema = z.object({
  secret: z.string().trim().min(1),
  defaultNotifyUrl: z.string().trim().optional(),
  defaultReturnUrl: z.string().trim().optional(),
  defaultCancelUrl: z.string().trim().optional(),
})

const normalizeOptionalUrl = (value?: string) => {
  const candidate = String(value || '').trim()
  if (!candidate) return ''
  return new URL(candidate).toString()
}

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.parse(await readBody(event))

  const nextConfig = await saveMinimalCheckoutAdminConfig({
    defaultNotifyUrl: normalizeOptionalUrl(parsed.defaultNotifyUrl),
    defaultReturnUrl: normalizeOptionalUrl(parsed.defaultReturnUrl),
    defaultCancelUrl: normalizeOptionalUrl(parsed.defaultCancelUrl),
  })

  await upsertMinimalCheckoutSecret(parsed.secret)

  return {
    ok: true,
    hasSecret: true,
    ...nextConfig,
  }
})
