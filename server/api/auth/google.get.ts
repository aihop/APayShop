import { handleOAuthLogin } from "../../utils/auth"
import { logger } from "../../utils/logger"

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    return handleOAuthLogin(event, 'google', {
      id: user.sub, // Google's unique ID for the user
      email: user.email || '',
      name: user.name || '',
      avatar: user.picture || '',
      // Google's userinfo endpoint returns this per the OIDC standard claim set.
      emailVerified: (user as any).email_verified === true || (user as any).email_verified === 'true',
    })
  },
  // Optional: Handle errors
  async onError(event, error) {
     await logger.error(`Google OAuth error: ${error.message}`, { 
        source: 'google_oauth', 
        details: { error } 
      })
    return sendRedirect(event, '/auth/login?error=google_auth_failed')
  }
})
