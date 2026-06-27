/**
 * Client-side locale persistence plugin.
 *
 * Priority order:
 * 1. localStorage (user's explicit choice, persisted across sessions)
 * 2. i18n_redirected cookie (browser detection, set by @nuxtjs/i18n)
 * 3. defaultLocale from nuxt config
 *
 * Writing: when user switches locale via LanguageSwitcher,
 * the layout's switchLocale function writes to both localStorage and cookie.
 */
export default defineNuxtPlugin({
  name: 'locale-persist',
  dependsOn: ['i18n:plugin'],
  async setup() {
    const { setLocale, locale } = useI18n()

    // Only run on client side
    if (import.meta.client) {
      const saved = localStorage.getItem('locale')
      if (saved && (saved === 'en' || saved === 'zh')) {
        if (saved !== locale.value) {
          await setLocale(saved)
        }
      }
    }
  },
})
