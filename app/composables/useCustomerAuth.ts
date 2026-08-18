import { computed, useUserSession } from '#imports'
import {
  beginWebSessionEstablishment,
  endWebSessionEstablishment,
  resetWebSessionReplacementNotice,
} from './useWebSessionMonitor'

export const useCustomerAuth = () => {
  const { loggedIn, user, session, fetch, clear } = useUserSession()
  const isCustomerLoggedIn = computed(() => loggedIn.value && !!user.value)

  const login = async (credentials: any) => {
    beginWebSessionEstablishment()
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })
      await fetch() // Refresh session state
      resetWebSessionReplacementNotice()
      return true
    } catch (error: any) {
      throw error.data || error
    } finally {
      endWebSessionEstablishment()
    }
  }

  const register = async (userData: any) => {
    beginWebSessionEstablishment()
    try {
      await $fetch('/api/auth/register', {
        method: 'POST',
        body: userData
      })
      await fetch() // Refresh session state
      resetWebSessionReplacementNotice()
      return true
    } catch (error: any) {
      throw error.data || error
    } finally {
      endWebSessionEstablishment()
    }
  }

  const logout = async () => {
    let succeeded = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed', error)
      succeeded = false
    } finally {
      session.value = null
      await clear().catch(() => {})
    }
    return succeeded
  }

  return {
    loggedIn: isCustomerLoggedIn,
    user,
    session,
    login,
    register,
    logout,
    fetchSession: fetch
  }
}
