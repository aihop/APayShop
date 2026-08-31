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
    const supportedLocales = new Set(
      (unref(i18n.locales) || []).map((locale: string | { code: string }) => (
        typeof locale === 'string' ? locale : locale.code
      )),
    )
    const saved = localStorage.getItem('locale') || ''
    if (supportedLocales.has(saved)) {
      if (saved !== unref(i18n.locale)) {
        await i18n.setLocale(saved)
      }
      return
    }

    // 若本地无手动选语言记录，优先对齐后台配置的站点默认语言
    const { fetchSettings, getSetting } = useSettings()
    await fetchSettings()
    const siteDefault = getSetting('default_locale') || ''
    if (supportedLocales.has(siteDefault) && siteDefault !== unref(i18n.locale)) {
      await i18n.setLocale(siteDefault)
    }
  },
})
