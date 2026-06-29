import { notifications } from '../db/schema'
import { db } from '../db/runtime'

export interface CreateNotificationInput {
  userId?: number | null
  visitorId?: string | null
  type: string
  title: string
  message: string
  data?: Record<string, any>
}

export async function createNotification(input: CreateNotificationInput) {
  const dataValue = input.data || {}

  await db.insert(notifications).values({
    userId: input.userId ?? null,
    visitorId: input.visitorId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    data: process.env.NUXT_HUB_DATABASE ? dataValue : JSON.stringify(dataValue) as any,
    isRead: false,
    createdAt: new Date(),
  } as any)
}
