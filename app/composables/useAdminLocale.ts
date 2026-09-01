import { unref } from 'vue'

const adminLocaleModules: Record<string, () => Promise<{ default: Record<string, any> }>> = {
  zh: () => import('~~/locales/zh/admin.json'),
  en: () => import('~~/locales/en/admin.json'),
  ru: () => import('~~/locales/ru/admin.json'),
  'zh-HK': () => import('~~/locales/zh-HK/admin.json'),
}

export const useAdminLocale = () => {
  const nuxtApp = useNuxtApp()
  const i18n = nuxtApp.$i18n || (useI18n ? useI18n() : null)

  const loadAdminLocale = async (targetLocale?: string) => {
    const active = targetLocale || (i18n ? unref(i18n.locale) : 'zh') || 'zh'
    const loadedMap = nuxtApp._loadedAdminLocales || (nuxtApp._loadedAdminLocales = new Set<string>())
    if (loadedMap.has(active)) {
      return
    }

    const loader = adminLocaleModules[active] || adminLocaleModules.en || adminLocaleModules.zh
    if (!loader) {
      return
    }

    try {
      const module = await loader()
      const messages = (module as any).default || module
      if (messages && i18n && typeof i18n.mergeLocaleMessage === 'function') {
        i18n.mergeLocaleMessage(active, messages)
        loadedMap.add(active)
      }
    } catch (e) {
      console.warn(`[useAdminLocale] Failed to load admin locale for ${active}:`, e)
    }
  }

  return {
    loadAdminLocale,
  }
}
