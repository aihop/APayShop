import { users } from "../../db/schema"
import { eq } from "drizzle-orm"
import { db } from '../../db/runtime'
import { ensureVisitorId, trackVisitorEvent } from "../../utils/visitorAnalytics"
import { getAIGatewayUrl, getIntegrationToken } from "../../utils/externalProxy"

/**
 * 浏览器扩展（qingpu-ai dash）登录：dash 是 chrome-extension:// 源，拿不到
 * apayshop 域名下的 httpOnly cookie session，所以密码校验通过后不走
 * setUserSession，而是直接返回一把可用的 ainode 网关 API Key（bearer），
 * 扩展把它存进本地 Settings.generalModelApiKey/generalModelBaseUrl 就能用——
 * 跟用户在 /user/keys 页面手动复制粘贴的效果一致，只是省了这一步。
 */

interface AinodeApiKey {
  id: number
  rawKey: string
  status: string
}

async function fetchOrCreateApiKey(userId: number): Promise<string> {
  const gatewayUrl = await getAIGatewayUrl()
  const integrationToken = await getIntegrationToken()
  if (!integrationToken) {
    throw createError({ statusCode: 502, message: '登录成功但获取密钥失败，请稍后重试（网关未配置）' })
  }

  const headers = {
    Authorization: `Bearer ${integrationToken}`,
    'X-Internal-User-Id': String(userId),
  }

  let listRes: { data?: AinodeApiKey[] }
  try {
    listRes = await $fetch(`${gatewayUrl}/api/site/api-keys/list`, { headers })
  } catch (err) {
    throw createError({ statusCode: 502, message: '登录成功但获取密钥失败，请稍后重试' })
  }

  const existing = (listRes?.data || []).find((key) => key.status === 'active')
  if (existing?.rawKey) {
    return existing.rawKey
  }

  try {
    const createRes: { data?: AinodeApiKey } = await $fetch(`${gatewayUrl}/api/site/api-keys/create`, {
      method: 'POST',
      headers,
      body: { name: '导入端' },
    })
    if (!createRes?.data?.rawKey) {
      throw new Error('missing rawKey in create response')
    }
    return createRes.data.rawKey
  } catch (err) {
    throw createError({ statusCode: 502, message: '登录成功但获取密钥失败，请稍后重试' })
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existingUsers.length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  const user = existingUsers[0]

  if (!user.passwordHash) {
    throw createError({
      statusCode: 401,
      message: 'This account uses third-party login'
    })
  }

  const isValid = await verifyPassword(user.passwordHash, password)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  const gatewayUrl = await getAIGatewayUrl()
  const apiKey = await fetchOrCreateApiKey(user.id)

  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

  await trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: user.id,
    eventName: 'auth',
    eventAction: 'extension_login',
  })

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname
    },
    apiKey,
    baseUrl: gatewayUrl,
  }
})
