export interface AdminNavItem {
  to: string
  icon: string
  labelKey: string
  labelFallback?: string
  exact?: boolean
  conditional?: () => boolean
}

export interface AdminNavSection {
  titleKey: string
  titleFallback?: string
  conditional?: () => boolean
  items: AdminNavItem[]
}

export const useAdminNav = () => {
  const { t } = useI18n()
  const hasKeyProducts = ref(false)
  const hasSubscriptionProducts = ref(false)

  const loadProductTypes = async () => {
    try {
      const res: any = await $fetch('/api/products/types')
      const types = res.data || []
      hasKeyProducts.value = types.includes('key')
      hasSubscriptionProducts.value = types.includes('subscription')
    } catch (e) {
      // ignore
    }
  }

  const storeSection: AdminNavSection = {
    titleKey: 'admin.nav.store',
    items: [
      { to: '/admin', icon: 'ph:squares-four', labelKey: 'admin.nav.dashboard', exact: true },
      { to: '/admin/stats', icon: 'ph:chart-bar', labelKey: 'admin.nav.stats' },
      { to: '/admin/orders', icon: 'ph:shopping-cart', labelKey: 'admin.nav.orders' },
      { to: '/admin/products', icon: 'ph:package', labelKey: 'admin.nav.products' },
      { to: '/admin/customers', icon: 'ph:users', labelKey: 'admin.nav.customers' },
      { to: '/admin/posts', icon: 'ph:newspaper-duotone', labelKey: 'admin.nav.blogs' },
      { to: '/admin/cards', icon: 'ph:barcode', labelFallback: 'Cards', conditional: () => hasKeyProducts.value },
      { to: '/admin/subscriptions', icon: 'ph:calendar-check', labelKey: 'admin.nav.subscriptions', conditional: () => hasSubscriptionProducts.value },
    ],
  }

  const configSection: AdminNavSection = {
    titleKey: 'admin.nav.configs',
    items: [
      { to: '/admin/promo', icon: 'ph:megaphone-simple', labelKey: 'admin.nav.promo' },
      { to: '/admin/payments', icon: 'ph:credit-card', labelKey: 'admin.nav.payments' },
      { to: '/admin/users', icon: 'ph:users-four', labelKey: 'admin.nav.users' },
      { to: '/admin/logs', icon: 'ph:log', labelKey: 'admin.nav.logs' },
      // themes 已收编为设置族成员页(入口在 settings 左栏导航,路由仍是 /admin/themes;
      // RouteSearch 里保留可搜),不再占侧栏一级位
      { to: '/admin/settings', icon: 'ph:gear', labelKey: 'admin.nav.settings' },
    ],
  }

  const resolveLabel = (item: AdminNavItem): string => {
    if (item.labelKey) {
      try {
        return t(item.labelKey)
      } catch (e) {
        return item.labelFallback || item.labelKey
      }
    }
    return item.labelFallback || ''
  }

  const resolveSectionTitle = (section: AdminNavSection): string => {
    if (section.titleKey) {
      try {
        return t(section.titleKey)
      } catch (e) {
        return section.titleFallback || section.titleKey
      }
    }
    return section.titleFallback || ''
  }

  return {
    storeSection,
    configSection,
    loadProductTypes,
    hasKeyProducts,
    hasSubscriptionProducts,
    resolveLabel,
    resolveSectionTitle,
  }
}

export const useAdminNavStyle = () => {
  const adminSectionTitleClass = 'mb-3 px-3 text-[11px] font-semibold tracking-wider text-gray-500 dark:text-gray-500'
  const adminMobileNavItemClass = 'block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#121214] dark:hover:text-white'
  const adminDesktopNavItemClass = 'block rounded-md px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#121214] dark:hover:text-white'
  const adminNavActiveClass = 'bg-gray-100 text-gray-900 dark:bg-[#121214] dark:text-white'

  return {
    adminSectionTitleClass,
    adminMobileNavItemClass,
    adminDesktopNavItemClass,
    adminNavActiveClass,
  }
}
