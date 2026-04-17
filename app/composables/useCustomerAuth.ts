export const useCustomerAuth = () => {
  const { loggedIn, user, session, fetch, clear } = useUserSession()
  const isCustomerLoggedIn = computed(() => loggedIn.value && !!user.value)

  const login = async (credentials: any) => {
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })
      await fetch() // Refresh session state
      return true
    } catch (error: any) {
      throw error.data || error
    }
  }

  const register = async (userData: any) => {
    try {
      await $fetch('/api/auth/register', {
        method: 'POST',
        body: userData
      })
      await fetch() // Refresh session state
      return true
    } catch (error: any) {
      throw error.data || error
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await clear() // Clear local session state
      return true
    } catch (error) {
      console.error('Logout failed', error)
      return false
    }
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
