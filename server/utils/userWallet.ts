import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { userWallets } from '../db/schema'

const isDuplicateKeyError = (error: unknown) =>
  /duplicate|unique/i.test(String((error as { message?: unknown })?.message || ''))

export async function getOrCreateUserWallet(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('getOrCreateUserWallet requires a positive userId')
  }

  const existing = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1)
  if (existing[0]) return existing[0]

  try {
    await db.insert(userWallets).values({ userId })
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }

  const created = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1)
  if (!created[0]) throw new Error(`Failed to create wallet for user ${userId}`)
  return created[0]
}

export async function updateUserWalletSubscription(input: {
  userId: number
  tierLevel: number
  subExpiresAt?: Date | null
}) {
  const wallet = await getOrCreateUserWallet(input.userId)
  await db.update(userWallets).set({
    tierLevel: Math.max(0, Math.trunc(Number(input.tierLevel) || 0)),
    ...(input.subExpiresAt !== undefined ? { subExpiresAt: input.subExpiresAt } : {}),
  }).where(eq(userWallets.id, wallet.id))
  return wallet.id
}
