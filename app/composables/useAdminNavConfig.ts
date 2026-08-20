export interface AdminNavItem {
  to: string
  icon: string
  labelKey?: string
  labelFallback?: string
  exact?: boolean
  conditional?: () => boolean
  permission?: string
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

  const { admin, hasPerm, loadAdmin } = useAdminPermissions()

  // No "still loading" fallback here on purpose: layouts/admin.vue awaits
  // loadAdmin() before any of the layout's children (this composable's
  // consumers included) render at all, on both server and client. By the
  // time hasPermissionFor() is ever called, admin state is already
  // resolved — so hasPerm()'s normal fail-closed behavior (no admin loaded
  // yet = no access) is exactly right, with nothing left to fail closed on.
  // An earlier version returned `true` while "not yet loaded", which showed
  // every nav item — including ones the admin has zero access to — for a
  // beat on every single page load before narrowing down after hydration.
  const hasPermissionFor = (perm: string | undefined) => {
    if (!perm) return true
    return hasPerm(perm)
  }

  const loadProductTypes = async () => {
    try {
      const typesP = (async () => {
        const res: any = await $fetch('/api/products/types')
        const types = res.data || []
        hasKeyProducts.value = types.includes('key')
        hasSubscriptionProducts.value = types.includes('subscription')
      })()
      // Idempotent — layouts/admin.vue already loaded this; this is just a
      // safety net if useAdminNav() is ever used somewhere that bypasses it.
      await Promise.all([typesP, loadAdmin()])
    } catch (e) {
      await loadAdmin()
    }
  }

  const makeItem = (item: AdminNavItem): AdminNavItem => {
    const existing = item.conditional
    if (item.permission) {
      return {
        ...item,
        conditional: () => hasPermissionFor(item.permission!) && (!existing || existing()),
      }
    }
    return item
  }

  const storeSectionBase: AdminNavSection = {
    titleKey: 'admin.nav.store',
    items: [
      { to: '/admin', icon: 'ph:squares-four', labelKey: 'admin.nav.dashboard', exact: true, permission: 'dashboard' },
      { to: '/admin/stats', icon: 'ph:chart-bar', labelKey: 'admin.nav.stats', permission: 'stats' },
      { to: '/admin/orders', icon: 'ph:shopping-cart', labelKey: 'admin.nav.orders', permission: 'orders' },
      { to: '/admin/topups', icon: 'ph:wallet', labelKey: 'admin.nav.topups', permission: 'orders' },
      { to: '/admin/products', icon: 'ph:package', labelKey: 'admin.nav.products', permission: 'products' },
      { to: '/admin/customers', icon: 'ph:users', labelKey: 'admin.nav.customers', permission: 'customers' },
      { to: '/admin/posts', icon: 'ph:newspaper-duotone', labelKey: 'admin.nav.blogs', permission: 'posts' },
      { to: '/admin/cards', icon: 'ph:barcode', labelFallback: 'Cards', permission: 'cards', conditional: () => hasKeyProducts.value },
      { to: '/admin/subscriptions', icon: 'ph:calendar-check', labelKey: 'admin.nav.subscriptions', permission: 'subscriptions', conditional: () => hasSubscriptionProducts.value },
    ],
  }

  const storeSection: AdminNavSection = {
    ...storeSectionBase,
    items: storeSectionBase.items.map(makeItem),
  }

  const configSectionBase: AdminNavSection = {
    titleKey: 'admin.nav.configs',
    items: [
      { to: '/admin/promo', icon: 'ph:megaphone-simple', labelKey: 'admin.nav.promo', permission: 'promo' },
      { to: '/admin/payments', icon: 'ph:credit-card', labelKey: 'admin.nav.payments', permission: 'payments' },
      { to: '/admin/logs', icon: 'ph:log', labelKey: 'admin.nav.logs', permission: 'logs' },
      { to: '/admin/settings', icon: 'ph:gear', labelKey: 'admin.nav.settings', permission: 'settings' }
    ],
  }

  const configSection: AdminNavSection = {
    ...configSectionBase,
    items: configSectionBase.items.map(makeItem),
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
    adminNavAdmin: admin,
    hasPermissionFor,
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
