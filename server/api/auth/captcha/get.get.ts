import { checkIpRateLimit, resolveClientIp } from '../../../utils/rateLimit'
import {
  CAPTCHA_BACKGROUNDS,
  createCaptchaChallengeToken,
  generateCaptchaBackgroundWithSlot,
  generateCaptchaPiece,
  PUZZLE_PATH,
} from '../../../utils/adminLoginSecurity'

export default defineEventHandler((event) => {
  const ip = resolveClientIp(event)
  const rl = checkIpRateLimit(`captcha:get:${ip}`, { max: 60, windowMs: 60_000 })
  if (!rl.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试',
    })
  }

  // 拼图尺寸 52x52，背景宽 330，高 155
  // X 范围：50 ~ 240
  // Y 范围：20 ~ 85
  const targetX = Math.floor(Math.random() * (240 - 50 + 1)) + 50
  const targetY = Math.floor(Math.random() * (85 - 20 + 1)) + 20
  const bgIndex = Math.floor(Math.random() * CAPTCHA_BACKGROUNDS.length)
  const nonce = Math.random().toString(36).slice(2, 10)

  const token = createCaptchaChallengeToken({
    x: targetX,
    y: targetY,
    bgIndex,
    timestamp: Date.now(),
    nonce,
  })

  const bgWithSlot = generateCaptchaBackgroundWithSlot(targetX, targetY, bgIndex)
  const pieceImg = generateCaptchaPiece(targetX, targetY, bgIndex)

  return {
    success: true,
    data: {
      token,
      bg: bgWithSlot,
      pieceImg,
      pieceY: targetY,
      puzzlePath: PUZZLE_PATH,
      pieceWidth: 52,
      pieceHeight: 52,
    },
  }
})
