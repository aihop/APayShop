import { handleOAuthLogin } from "../../utils/auth"
import { logger } from "../../utils/logger"

export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
  },
  async onSuccess(event, { user, tokens }) {
    // GitHub's main /user response's `email` is the user's public profile
    // email — anyone can put ANY address there, GitHub does not require it
    // to be owned/verified. Only /user/emails carries a genuine per-address
    // `verified` flag. nuxt-auth-utils only consults /user/emails as a
    // fallback when the public email field is empty, so trusting its
    // (conditionally-set) email_verified alone would wrongly treat most
    // legitimate users — whose public email happens to be non-empty — as
    // unverified. Cross-checking here ourselves gets it right either way.
    let email = user.email || ''
    let emailVerified = false
    try {
      const emails = await $fetch<Array<{ email: string; primary: boolean; verified: boolean }>>(
        'https://api.github.com/user/emails',
        { headers: { 'User-Agent': 'apay-oauth', Authorization: `token ${tokens.access_token}` } },
      )
      const primary = emails.find(e => e.primary) || emails.find(e => e.verified)
      if (primary) {
        email = primary.email
        emailVerified = primary.verified === true
      } else if (email) {
        emailVerified = emails.some(e => e.email === email && e.verified)
      }
    } catch {
      // Couldn't confirm either way — conservatively unverified rather than
      // trusting the unverifiable public-profile email.
      emailVerified = false
    }

    return handleOAuthLogin(event, 'github', {
      id: String(user.id), // GitHub returns id as a number, we need it as a string
      email,
      name: user.name || user.login, // Fallback to login name if real name is not set
      avatar: user.avatar_url || '',
      emailVerified,
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
