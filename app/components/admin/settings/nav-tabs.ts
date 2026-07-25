// 设置族页面的左栏导航单点:settings 页内 tab + 带独立路由的成员页。
// settings.vue(query 校验)与 AdminSettingsNav(渲染)共同消费,防两处清单漂移。
// 2026-07 themes 从侧栏一级入口收编为设置族成员:视觉并入设置导航,
// 但保留 /admin/themes 独立路由(书签/RouteSearch/文档链接不破坏)。
export interface SettingsNavTab {
  id: string
  labelKey: string
  icon: string
  /** 有 route 的是"路由型成员页":点击跳转整页,而非切 settings 页内 tab */
  route?: string
}

export const SETTINGS_NAV_TABS: SettingsNavTab[] = [
  { id: 'general', labelKey: 'admin.settings.page.nav_general', icon: 'ph:browser-fill' },
  { id: 'localization', labelKey: 'admin.settings.page.nav_localization', icon: 'ph:translate-fill' },
  { id: 'seo', labelKey: 'admin.settings.page.nav_seo', icon: 'ph:magnifying-glass-fill' },
  { id: 'checkout', labelKey: 'admin.settings.page.nav_checkout', icon: 'ph:shopping-cart-fill' },
  { id: 'topup', labelKey: 'admin.settings.page.nav_topup', icon: 'ph:wallet-fill' },
  { id: 'integration', labelKey: 'admin.settings.page.nav_integration', icon: 'ph:shuffle-fill' },
  { id: 'email', labelKey: 'admin.settings.page.nav_email', icon: 'ph:envelope-fill' },
  { id: 'company', labelKey: 'admin.settings.page.nav_company', icon: 'ph:buildings-fill' },
  { id: 'automations', labelKey: 'admin.settings.page.nav_automations', icon: 'ph:lightning-fill' },
  { id: 'scheduler', labelKey: 'admin.settings.page.nav_scheduler', icon: 'ph:clock-countdown-fill' },
  { id: 'themes', labelKey: 'admin.nav.themes', icon: 'ph:sparkles-duotone', route: '/admin/themes' },
]

/** 是否为 settings 页内合法 tab id(路由型成员不算——它们不由 activeTab 渲染) */
export const isSettingsTabId = (value: unknown): value is string =>
  typeof value === 'string' && SETTINGS_NAV_TABS.some(tab => !tab.route && tab.id === value)
