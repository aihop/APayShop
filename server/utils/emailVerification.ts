import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import { db } from '../db/runtime'

export type EmailVerifyPolicy = 'disabled' | 'banner' | 'strict'

export const EMAIL_VERIFY_POLICY_KEY = 'email_verify_policy'

/**
 * 获取系统当前配置的邮箱验证策略
 * - 'disabled': 关闭验证，全功能直接开放，不展示提醒横幅
 * - 'banner': 软提示模式，允许正常登录和消费，前台展示验证提示横幅（推荐默认）
 * - 'strict': 严格强验证模式，未验证邮箱前限制使用受保护核心业务功能
 */
export async function getEmailVerifyPolicy(): Promise<EmailVerifyPolicy> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, EMAIL_VERIFY_POLICY_KEY))
      .limit(1)

    const raw = rows[0]?.value?.trim().toLowerCase()
    if (raw === 'disabled' || raw === 'strict' || raw === 'banner') {
      return raw as EmailVerifyPolicy
    }
  } catch (err) {
    console.error('[EmailVerification] Failed to read email_verify_policy from settings:', err)
  }

  // 默认策略为软提示横幅
  return 'banner'
}

/**
 * 判断用户对象是否已完成邮箱验证
 */
export function isUserEmailVerified(user: { emailVerifiedAt?: Date | string | null } | null | undefined): boolean {
  return Boolean(user?.emailVerifiedAt)
}
