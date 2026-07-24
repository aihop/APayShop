import { defineEventHandler, readBody } from 'h3'
import { getAIGatewayUrl } from '../../../utils/externalProxy'
import { getRequestLocale } from '../../../utils/requestLocale'

// 异步任务轮询代理:用用户选定的 API Key 查询网关 /v1/tasks/{taskId}。
// 用 POST(而非 GET)以免把 apiKey 放进 URL/日志。
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event).catch(() => null)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const body = await readBody(event)
  const { apiKey, taskId } = body || {}
  if (!apiKey || !taskId) {
    throw createError({ statusCode: 400, statusMessage: locale === 'zh' ? '请求参数错误：缺少 apiKey 或 taskId' : 'Bad Request: missing apiKey or taskId' })
  }

  const baseUrl = await getAIGatewayUrl()
  const upstream = await fetch(`${baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30000),
  })

  const text = await upstream.text()
  if (!upstream.ok) {
    let msg = `HTTP ${upstream.status}`
    try {
      const j = JSON.parse(text)
      msg = j?.error?.message || j?.message || msg
    } catch {}
    throw createError({ statusCode: upstream.status, statusMessage: msg.slice(0, 300) })
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
})
