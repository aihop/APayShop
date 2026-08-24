// 设置族页面的左栏导航单点:settings 页内 tab + 带独立路由的成员页。
// settings/index.vue(query 校验)与 AdminSettingsNav(渲染)共同消费,防两处清单漂移。
// 2026-07 themes 从侧栏一级入口收编为设置族成员,物理路径也收编到 /admin/settings/themes,
// URL 层级与视觉层级对齐,未来加单主题详情页可直接放 settings/themes/[id].vue。
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
  { id: 'email', labelKey: 'admin.settings.page.nav_email', icon: 'ph:envelope-fill' },
  { id: 'company', labelKey: 'admin.settings.page.nav_company', icon: 'ph:buildings-fill' },
  { id: 'automations', labelKey: 'admin.settings.page.nav_automations', icon: 'ph:lightning-fill' },
  { id: 'scheduler', labelKey: 'admin.settings.page.nav_scheduler', icon: 'ph:clock-countdown-fill' },
  { id: 'users', labelKey: 'admin.nav.manages', icon: 'ph:users-four', route: '/admin/settings/manages' },
  { id: 'authorization', labelKey: 'admin.settings.page.nav_authorization', icon: 'ph:key-fill', route: '/admin/settings/authorization' },
  { id: 'themes', labelKey: 'admin.nav.themes', icon: 'ph:sparkle-duotone', route: '/admin/settings/themes' },
  { id: 'extensions', labelKey: 'admin.nav.extensions', icon: 'ph:puzzle-piece-fill', route: '/admin/settings/extensions' },
  { id: 'product-presets', labelKey: 'admin.settings.presets.nav', icon: 'ph:list-plus-fill', route: '/admin/settings/product-presets' },
]

/** 是否为 settings 页内合法 tab id(路由型成员不算——它们不由 activeTab 渲染) */
export const isSettingsTabId = (value: unknown): value is string =>
  typeof value === 'string' && SETTINGS_NAV_TABS.some(tab => !tab.route && tab.id === value)
