/**
 * 低层 HTTP Webhook 发送器（带指数退避重试与超时熔断）
 *
 * 重试策略:
 * - 4xx: 客户端错误（参数或 URL 有误），不重试
 * - 5xx / 网络超时: 自动按指数退避重试（1s → 2s → 4s）最多 3 次
 * - 返回 { ok: true, status } 或 { ok: false, status? }
 */
export async function sendHttpWebhook(
  url: string,
  body: object,
  options?: { headers?: Record<string, string>; retries?: number; timeout?: number }
): Promise<{ ok: boolean; status?: number }> {
  const maxRetries = options?.retries ?? 3
  const timeout = options?.timeout ?? 8000
  const bodyStr = JSON.stringify(body)
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
        return { ok: true, status: response.status }
      }

      if (response.status >= 400 && response.status < 500) {
        console.warn(`[EventBus] 4xx POST ${url} (${response.status}), not retrying`)
        return { ok: false, status: response.status }
      }

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