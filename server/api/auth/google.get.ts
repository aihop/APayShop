import { handleOAuthLogin } from "../../utils/auth"
import { logger } from "../../utils/logger"

export default defineOAuthGoogleEventHandler({
  config: {
    // You can set emailRequired: true if needed
    emailRequired: true,
  },
  async onSuccess(event, { user }) {
    return handleOAuthLogin(event, 'google', {
      id: user.sub, // Google's unique ID for the user
      email: user.email || '',
      name: user.name || '',
      avatar: user.picture || ''
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
