import crypto from "crypto"
import { z } from "zod"
import { usersTokens } from "../../../db/schema"
import { eq, and, ne, or, isNull, count } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { EMAIL_VERIFY_TOKEN_NAME } from '../../../utils/auth'
import { getRequestLocale } from '../../../utils/requestLocale'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Preset expiry windows only — an arbitrary client-supplied date would let
  // a caller mint a token that outlives any reasonable review cadence.
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).optional(),
})

const MAX_ACTIVE_TOKENS = 20

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await requireUserSession(event)
  const userId = session.user.id

  // Token management must go through the real login session, not a bearer
  // token — otherwise a single leaked token could mint itself unlimited
  // replacements (or outlive a revocation) with no further credential needed.
  if (event.context.authenticatedFromToken) {
    throw createError({
      statusCode: 403,
      message: locale === 'zh' ? '请使用登录会话管理 API Token，不能用 Token 本身操作' : 'Manage API tokens from a logged-in session, not via another token',
    })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? '请求参数无效' : 'Invalid request',
    })
  }
  const { name, expiresInDays } = parsed.data

  const [{ value: activeCount }] = await db.select({ value: count() })
    .from(usersTokens)
    .where(and(
      eq(usersTokens.userId, userId),
      eq(usersTokens.revoked, false),
      or(isNull(usersTokens.name), ne(usersTokens.name, EMAIL_VERIFY_TOKEN_NAME)),
    ))
  if (activeCount >= MAX_ACTIVE_TOKENS) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh' ? `最多只能创建 ${MAX_ACTIVE_TOKENS} 个有效 Token，请先吊销一些` : `You can have at most ${MAX_ACTIVE_TOKENS} active tokens — revoke one first`,
    })
  }

  // Prefixed + high-entropy: the "apay_" prefix makes leaked-secret scanners
  // (GitHub push protection etc.) recognize it, unlike the bare UUIDs used
  // for single-use email-verify tokens elsewhere in this table.
  const rawToken = `apay_${crypto.randomBytes(32).toString('base64url')}`
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400 * 1000) : null

  const inserted = await db.insert(usersTokens).values({
    userId,
    token: rawToken,
    name,
    expiresAt,
  }).returning()

  return {
    // The raw token is only ever returned here, at creation — it cannot be
    // retrieved again afterwards (list/GET never selects usersTokens.token).
    token: rawToken,
    data: {
      id: inserted[0].id,
      name: inserted[0].name,
      expiresAt: inserted[0].expiresAt,
      createdAt: inserted[0].createdAt,
    },
  }
})
