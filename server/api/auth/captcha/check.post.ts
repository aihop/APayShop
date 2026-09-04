import { checkIpRateLimit, resolveClientIp } from '../../../utils/rateLimit'
import {
  issueCaptchaTicket,
  verifyCaptchaChallengeToken,
} from '../../../utils/adminLoginSecurity'

// 容差范围（像素）
const TOLERANCE_PX = 5

export default defineEventHandler(async (event) => {
  const ip = resolveClientIp(event)
  const rl = checkIpRateLimit(`captcha:check:${ip}`, { max: 30, windowMs: 60_000 })
  if (!rl.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: '验证过于频繁，请稍后再试',
    })
  }

  const body = await readBody(event)
  const { token, moveX } = body || {}

  if (!token || typeof moveX !== 'number') {
    throw createError({
      statusCode: 400,
      message: '缺少验证参数',
    })
  }

  const challenge = verifyCaptchaChallengeToken(token)
  if (!challenge) {
    throw createError({
      statusCode: 400,
      message: '验证已过期，请刷新重试',
    })
  }

  const diff = Math.abs(moveX - challenge.x)
  if (diff > TOLERANCE_PX) {
    throw createError({
      statusCode: 400,
      message: '滑块未对齐，请重试',
    })
  }

  const ticket = issueCaptchaTicket(ip)

  return {
    success: true,
    ticket,
  }
})
