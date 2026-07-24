import { defineEventHandler, readBody } from 'h3'
import { getAIGatewayUrl } from '../../../utils/externalProxy'
import { getRequestLocale } from '../../../utils/requestLocale'

// 视频生成代理(异步):用用户选定的 API Key 提交到网关 /v1/video/generations,返回任务对象。
// 之后由前端轮询 /api/proxy/playground/task 拿结果。
export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session = await getUserSession(event).catch(() => null)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const body = await readBody(event)
  const { apiKey, model, prompt, negativePrompt, duration, size } = body || {}
  if (!apiKey || !model || !prompt) {
    throw createError({ statusCode: 400, statusMessage: locale === 'zh' ? '请求参数错误：缺少 apiKey、model 或 prompt' : 'Bad Request: missing apiKey, model, or prompt' })
  }

  const baseUrl = await getAIGatewayUrl()
  const payload: Record<string, any> = { model, prompt }
  if (negativePrompt) payload.negative_prompt = negativePrompt
  if (duration) payload.duration = Number(duration)
  if (size) payload.size = size

  const upstream = await fetch(`${baseUrl}/v1/video/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
