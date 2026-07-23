import { normalizeJson } from './utils'

export type PromoTracking = {
  inviteCode: string
  promoCode: string
  agentCode: string
}

export async function capturePromoTracking(event: any) {
  const query = getQuery(event)
  const inviteCode = String(query.invite || query.inv || '').trim().toUpperCase()
  const promoCode = String(query.promo || '').trim().toUpperCase()
  const agentCode = String(query.agent || '').trim().toUpperCase()

  const tracked = {
    inviteCode,
    promoCode,
    agentCode,
  }

  if (inviteCode || promoCode || agentCode) {
    setCookie(event, 'promo_tracking', JSON.stringify(tracked), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return tracked
}

export function readPromoTracking(event: any) {
  const raw = getCookie(event, 'promo_tracking')
  return normalizeJson(raw, {
    inviteCode: '',
    promoCode: '',
    agentCode: '',
  })
}

export function mergePromoTracking(...sources: Array<Partial<PromoTracking> | null | undefined>): PromoTracking {
  return sources.reduce<PromoTracking>((acc, source) => ({
    inviteCode: String(source?.inviteCode || '').trim().toUpperCase() || acc.inviteCode,
    promoCode: String(source?.promoCode || '').trim().toUpperCase() || acc.promoCode,
    agentCode: String(source?.agentCode || '').trim().toUpperCase() || acc.agentCode,
  }), {
    inviteCode: '',
    promoCode: '',
    agentCode: '',
  })
}
