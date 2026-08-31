import { H3Event, getHeader, getCookie, setCookie } from 'h3'
import { randomBytes } from 'node:crypto'
import { Errors } from './errors'

const CSRF_COOKIE_NAME = 'goray_csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

export const issueCsrfToken = (event: H3Event): string => {
  let token = getCookie(event, CSRF_COOKIE_NAME)
  if (!token) {
    token = randomBytes(24).toString('base64url')
    setCookie(event, CSRF_COOKIE_NAME, token, {
      httpOnly: false, // 允许前端 JS 读取放入 header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 7,
    })
  }
  return token
}

export const verifyCsrf = (event: H3Event): void => {
  const method = event.node.req.method?.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return
  }

  // 1. 验证 Origin / Referer
  const origin = getHeader(event, 'origin')
  const host = getHeader(event, 'host')
  if (origin && host) {
    const originHost = new URL(origin).host
    if (originHost !== host) {
      throw Errors.forbidden('Cross-Origin Request Blocked')
    }
  }

  // 2. 验证 CSRF Token (双重 Cookie 提交)
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)
  const headerToken = getHeader(event, CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw Errors.forbidden('Invalid or Missing CSRF Token')
  }
}
