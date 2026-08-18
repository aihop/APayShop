import { readonly, useState, useUserSession } from '#imports'
import { $fetch as fetchSessionStatus } from 'ofetch'

export interface SessionReplacementNotice {
  code: 'SESSION_REPLACED'
  deviceType: string | null
  browser: string | null
  os: string | null
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  loggedInAt: string | null
}

let intervalId: ReturnType<typeof setInterval> | null = null
let checking = false
let sessionEstablishing = false
let sessionGeneration = 0

export const beginWebSessionEstablishment = () => {
  sessionEstablishing = true
  sessionGeneration += 1
}

export const endWebSessionEstablishment = () => {
  sessionEstablishing = false
  sessionGeneration += 1
}

export const resetWebSessionReplacementNotice = () => {
  useState<SessionReplacementNotice | null>('web-session-replacement', () => null).value = null
}

const isReplacementNotice = (value: unknown): value is SessionReplacementNotice => {
  return Boolean(value && typeof value === 'object' && (value as { code?: string }).code === 'SESSION_REPLACED')
}

export const useWebSessionMonitor = () => {
  const notice = useState<SessionReplacementNotice | null>('web-session-replacement', () => null)
  const { session } = useUserSession()

  const acceptNotice = (replacement: SessionReplacementNotice) => {
    notice.value = replacement
    session.value = null
  }

  const check = async () => {
    if (checking || sessionEstablishing || notice.value) return
    const embedded = session.value?.sessionReplaced
    if (isReplacementNotice(embedded)) {
      acceptNotice(embedded)
      return
    }
    if (!session.value?.user) return

    const generation = sessionGeneration
    checking = true
    try {
      const result = await fetchSessionStatus<{
        active: boolean
        reason: SessionReplacementNotice | null
      }>('/api/auth/session-status', { retry: false })
      if (!sessionEstablishing && generation === sessionGeneration && isReplacementNotice(result.reason)) {
        acceptNotice(result.reason)
      }
    } catch (error: unknown) {
      const data = (error as { data?: { data?: unknown } })?.data?.data
      if (!sessionEstablishing && generation === sessionGeneration && isReplacementNotice(data)) {
        acceptNotice(data)
      }
    } finally {
      checking = false
    }
  }

  const onFocus = () => void check()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void check()
  }

  const start = () => {
    if (import.meta.server || intervalId) return
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    intervalId = setInterval(() => void check(), 30_000)
    void check()
  }

  const stop = () => {
    if (import.meta.server) return
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    if (intervalId) clearInterval(intervalId)
    intervalId = null
  }

  const resetNotice = () => {
    resetWebSessionReplacementNotice()
  }

  return { notice: readonly(notice), start, stop, check, resetNotice }
}
