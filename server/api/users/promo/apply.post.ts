import { desc, eq } from 'drizzle-orm'
import { db } from '../../../db/runtime'
import { promoApplications } from '../../../db/schema'
import { checkUserPromoAccess } from '../../../promo/service'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const session: any = await requireUserSession(event)
  const userId = Number(session?.user?.id || 0)
  if (!userId) {
    throw createError({ statusCode: 401, message: locale === 'zh' ? '未登录' : 'Unauthorized' })
  }

  const body = await readBody(event)
  const channelInfo = String(body?.channelInfo || '').trim()
  const contact = String(body?.contact || '').trim()
  const reason = String(body?.reason || '').trim()

  if (!contact) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '请填写联系方式' : 'Contact is required' })
  }

  const access = await checkUserPromoAccess(userId)
  if (access.allowed) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '您已开通推广权限，无需重复申请' : 'Promo access already granted' })
  }

  if (access.mode === 'paid_and_audit' && !access.hasActiveSubscription && access.totalSpend < access.minSpendAmount) {
    throw createError({
      statusCode: 400,
      message: locale === 'zh'
        ? `未满足消费门槛（需开通有效订阅或累计消费满 $${access.minSpendAmount}）`
        : `Spend threshold not met ($${access.minSpendAmount} required)`,
    })
  }

  // 检查是否有待审核的申请
  const pendingApps = await db.select()
    .from(promoApplications)
    .where(eq(promoApplications.userId, userId))
    .orderBy(desc(promoApplications.createdAt))
    .limit(1)

  if (pendingApps.length > 0 && pendingApps[0].status === 'pending') {
    throw createError({ statusCode: 400, message: locale === 'zh' ? '已有申请正在审核中，请耐心等待' : 'An application is already pending' })
  }

  const inserted = await db.insert(promoApplications).values({
    userId,
    status: 'pending',
    channelInfo: channelInfo || null,
    contact,
    reason: reason || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return {
    ok: true,
    data: inserted[0],
    message: locale === 'zh' ? '申请已提交，请等待管理员审核' : 'Application submitted successfully',
  }
})
