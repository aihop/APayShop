import { users, oauthAccounts } from "../db/schema"
import { eq, and } from "drizzle-orm"
import { db } from '@nuxthub/db'
import { H3Event } from 'h3'


interface OAuthProfile {
  id: string;      // The unique ID from the provider
  email: string;   // The user's email
  name?: string;   // The user's display name
  avatar?: string; // The user's profile picture URL
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

  // Set user session
  await setUserSession(event, {
    user: {
      id: finalUserId,
      email: finalUserEmail,
      nickname: finalUserNickname,
      avatarUrl: finalUserAvatar
    },
    admin: null,
  })

  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, finalUserId))

  // Redirect to home page or dashboard after successful login
  return sendRedirect(event, '/')
}
