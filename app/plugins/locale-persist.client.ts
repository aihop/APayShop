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
 *
 * 注意:插件的 setup() 没有组件实例上下文,不能调用 vue-i18n 的 useI18n()
 * (会抛 "Must be called at the top of a `setup` function")。
 * 必须使用全局实例 nuxtApp.$i18n。
 */
export default defineNuxtPlugin({
  name: 'locale-persist',
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    const i18n = nuxtApp.$i18n as any
    if (!i18n) return

    // .client.ts 插件本就只在客户端运行,localStorage 可直接访问
    const saved = localStorage.getItem('locale')
    if (saved === 'en' || saved === 'zh') {
      if (saved !== unref(i18n.locale)) {
        await i18n.setLocale(saved)
      }
    }
  },
})
