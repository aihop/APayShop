import { handleOAuthLogin } from "../../utils/auth"
import { logger } from "../../utils/logger"

export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
  },
  async onSuccess(event, { user }) {
    return handleOAuthLogin(event, 'github', {
      id: String(user.id), // GitHub returns id as a number, we need it as a string
      email: user.email || '',
      name: user.name || user.login, // Fallback to login name if real name is not set
      avatar: user.avatar_url || ''
    })
  },
  async onError(event, error) {
     await logger.error(`GitHub OAuth error: ${error.message}`, { 
        source: 'github_oauth', 
        details: { error } 
      })
    return sendRedirect(event, '/auth/login?error=github_auth_failed')
  }
})
