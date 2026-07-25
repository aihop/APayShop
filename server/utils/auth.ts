import { users, oauthAccounts, usersTokens, settings } from "../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '../db/runtime'
import { H3Event } from 'h3'
import { ensureVisitorId, trackVisitorEvent } from "./visitorAnalytics"

// users_tokens.name 里的保留值：标记这条 token 只能用于邮箱验证，
// 不是站内 API token —— server/middleware/auth.ts 靠这个把它挡在
// 「凭 token 直接登录/调 API」的通用鉴权之外（验证链接可能经邮件/日志外泄，
// 绝不能顺带拿到完整账号权限）。
export const EMAIL_VERIFY_TOKEN_NAME = 'email_verify'

/**
 * 检查是否禁止多设备登录
 */
export async function isMultiDeviceLoginDisabled(): Promise<boolean> {
  try {
    const result = await db.select().from(settings).where(eq(settings.key, 'disable_multi_device_login')).limit(1);
    if (result.length > 0 && result[0].value) {
      return result[0].value.toLowerCase() === 'true' || result[0].value === '1';
    }
  } catch (err) {
    console.error('[Auth] Failed to check multi-device login setting:', err);
  }
  return false;
}

/**
 * 生成新的会话 ID
 */
export function generateSessionId(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}


interface OAuthProfile {
  id: string;      // The unique ID from the provider
  email: string;   // The user's email
  name?: string;   // The user's display name
  avatar?: string; // The user's profile picture URL
  // Whether the PROVIDER confirmed this email belongs to the authenticating
  // person. Must be true before we ever auto-link to an existing account —
  // GitHub's public profile `email` field in particular is NOT verified
  // (anyone can put any address there), so trusting a bare email match here
  // would let an attacker take over any account by setting their GitHub
  // profile email to the victim's and clicking "Sign in with GitHub".
  emailVerified?: boolean;
}

/**
 * Universal handler for all OAuth providers.
 * Handles the logic of finding existing users, creating new ones, linking accounts, and setting the session.
 */
export async function handleOAuthLogin(event: H3Event, providerName: string, profile: OAuthProfile) {
  // 1. Check if this OAuth account is already linked to a user
  const existingOAuth = await db.select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, providerName),
        eq(oauthAccounts.providerAccountId, profile.id)
      )
    )
    .limit(1)

  let finalUserId: number;
  let finalUserEmail = profile.email;
  let finalUserNickname = profile.name || profile.email.split('@')[0];
  let finalUserAvatar = profile.avatar || '';
  let isNewRegistration = false;

  if (existingOAuth.length > 0) {
    // User is already registered with this provider, log them in
    finalUserId = existingOAuth[0].userId
    
    // Fetch the latest user info from the users table
    const existingUser = await db.select().from(users).where(eq(users.id, finalUserId)).limit(1)
    if (existingUser.length > 0) {
      finalUserEmail = existingUser[0].email
      finalUserNickname = existingUser[0].nickname || finalUserNickname
      finalUserAvatar = existingUser[0].avatarUrl || finalUserAvatar
    }
  } else {
    // 2. This OAuth account is NOT linked. Check if a user with this email already exists
    const existingUserByEmail = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)

    if (existingUserByEmail.length > 0) {
      // Refuse to auto-link onto an existing account unless the provider
      // itself vouches that this email is verified. Without this check, an
      // unverified email match is enough to silently take over any account
      // (all orders, balance, subscription) — see the note on
      // OAuthProfile.emailVerified above for the concrete GitHub exploit.
      if (!profile.emailVerified) {
        return sendRedirect(event, '/auth/login?error=oauth_email_unverified')
      }

      // Link this OAuth account to the existing user
      finalUserId = existingUserByEmail[0].id
      finalUserEmail = existingUserByEmail[0].email
      finalUserNickname = existingUserByEmail[0].nickname || finalUserNickname
      finalUserAvatar = existingUserByEmail[0].avatarUrl || finalUserAvatar

      await db.insert(oauthAccounts).values({
        userId: finalUserId,
        provider: providerName,
        providerAccountId: profile.id
      })
    } else {
      // 3. Completely new user. Create in users table AND oauth_accounts table
      isNewRegistration = true

      const newUser = await db.insert(users).values({
        email: profile.email,
        nickname: finalUserNickname,
        avatarUrl: finalUserAvatar,
        // passwordHash is left null since they use OAuth
      }).returning()

      finalUserId = newUser[0].id

      await db.insert(oauthAccounts).values({
        userId: finalUserId,
        provider: providerName,
        providerAccountId: profile.id
      })
    }
  }

  // 检查是否禁止多设备登录
  const isDisabled = await isMultiDeviceLoginDisabled()
  let sessionId: string | undefined = undefined
  if (isDisabled) {
    // 生成新的会话 ID 并更新到用户表
    sessionId = generateSessionId()
    await db.update(users).set({ currentSessionId: sessionId }).where(eq(users.id, finalUserId))
  }

  // Set user session
  await setUserSession(event, {
    user: {
      id: finalUserId,
      email: finalUserEmail,
      nickname: finalUserNickname,
      avatarUrl: finalUserAvatar
    },
    admin: null,
    sessionId: sessionId // 存储会话 ID 用于验证
  })

  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, finalUserId))

  // Track login/register event for visitor stats
  trackVisitorEvent(event, {
    visitorId: ensureVisitorId(event),
    userId: finalUserId,
    eventName: 'auth',
    eventAction: isNewRegistration ? 'register' : 'login',
  }).catch(() => {})

  // Redirect to home page or dashboard after successful login
  return sendRedirect(event, '/')
}
