export interface AdminPermissionDef {
  code: string
  label: string
  labelZh: string
  apiPrefixes: string[]
  routes: string[]
}

export const ADMIN_PERMISSIONS: AdminPermissionDef[] = [
  {
    code: 'dashboard',
    label: 'Dashboard',
    labelZh: '仪表盘',
    apiPrefixes: ['dashboard'],
    routes: ['/admin/dashboard'],
  },
  {
    code: 'stats',
    label: 'Statistics',
    labelZh: '访客统计',
    apiPrefixes: ['stats'],
    routes: ['/admin/stats'],
  },
  {
    code: 'products',
    label: 'Products Management',
    labelZh: '商品管理',
    apiPrefixes: ['products'],
    routes: ['/admin/products'],
  },
  {
    code: 'orders',
    label: 'Orders Management',
    labelZh: '订单管理',
    apiPrefixes: ['orders'],
    routes: ['/admin/orders'],
  },
  {
    code: 'payments',
    label: 'Payments Management',
    labelZh: '支付管理',
    apiPrefixes: ['payments'],
    routes: ['/admin/payments'],
  },
  {
    code: 'customers',
    label: 'Customers Management',
    labelZh: '客户管理',
    apiPrefixes: ['customers', 'users'],
    routes: ['/admin/customers'],
  },
  {
    code: 'cards',
    label: 'Cards / Codes Management',
    labelZh: '卡密管理',
    apiPrefixes: ['cards'],
    routes: ['/admin/cards'],
  },
  {
    code: 'subscriptions',
    label: 'Subscriptions Management',
    labelZh: '订阅管理',
    apiPrefixes: ['subscriptions'],
    routes: ['/admin/subscriptions'],
  },
  {
    code: 'posts',
    label: 'Posts / Blog Management',
    labelZh: '文章管理',
    apiPrefixes: ['posts'],
    routes: ['/admin/posts'],
  },
  {
    code: 'promo',
    label: 'Promo & Affiliate System',
    labelZh: '推广体系',
    apiPrefixes: ['promo'],
    routes: ['/admin/promo'],
  },
  {
    code: 'logs',
    label: 'Logs & Access Records',
    labelZh: '日志查询',
    apiPrefixes: ['logs', 'access-logs'],
    routes: ['/admin/logs'],
  },
  {
    code: 'settings',
    label: 'System Settings',
    labelZh: '系统设置',
    apiPrefixes: ['settings', 'setup', 'email', 'event-rules'],
    routes: ['/admin/settings', '/admin/settings/themes'],
  },
  {
    code: 'admins',
    label: 'Admins Management',
    labelZh: '管理员管理',
    apiPrefixes: ['admins'],
    routes: ['/admin/settings/manages'],
  },
]

export const ADMIN_PERMISSION_MAP: Record<string, AdminPermissionDef> =
  Object.fromEntries(ADMIN_PERMISSIONS.map(p => [p.code, p]))

export const isSuperAdmin = (username: string | null | undefined) => username === 'admin'

// null/undefined = legacy/unset row => full access (back-compat).
// An explicit [] means "no permissions" and must NOT be treated as full access.
export const hasAllPermissions = (permissions: string[] | null | undefined) =>
  !permissions || permissions.includes('*')

export const adminHasPermission = (
  admin: { username?: string | null; permissions?: string[] | null } | null | undefined,
  permissionCode: string,
): boolean => {
  if (!admin) return false
  if (isSuperAdmin(admin.username)) return true
  if (hasAllPermissions(admin.permissions)) return true
  return Array.isArray(admin.permissions) && admin.permissions.includes(permissionCode)
}

export const adminHasAnyRouteAccess = (
  admin: { username?: string | null; permissions?: string[] | null } | null | undefined,
): boolean => {
  if (!admin) return false
  if (isSuperAdmin(admin.username)) return true
  if (hasAllPermissions(admin.permissions)) return true
  return Array.isArray(admin.permissions) && admin.permissions.length > 0
}

export const isRouteAllowedForAdmin = (
  path: string,
  admin: { username?: string | null; permissions?: string[] | null } | null | undefined,
): boolean => {
  if (!admin) return false
  if (isSuperAdmin(admin.username)) return true
  if (hasAllPermissions(admin.permissions)) return true
  const allowed: Set<string> = new Set()
  for (const code of (admin.permissions as string[]) || []) {
    const def = ADMIN_PERMISSION_MAP[code]
    if (def) {
      for (const r of def.routes) allowed.add(r)
    }
  }
  if (allowed.has(path)) return true
  for (const r of allowed) {
    if (path.startsWith(`${r}/`)) return true
  }
  if (path === '/admin/profile' || path === '/admin/login' || path === '/admin/logout' || path === '/admin/setup') {
    return true
  }
  return false
}

// Picks the first route this admin is actually allowed to land on, in
// ADMIN_PERMISSIONS priority order. Used as the post-login/fallback target
// instead of a hardcoded '/admin' — an admin without the 'dashboard'
// permission can't access '/admin', so redirecting there unconditionally
// causes an infinite bounce against isRouteAllowedForAdmin.
export const firstAllowedAdminRoute = (
  admin: { username?: string | null; permissions?: string[] | null } | null | undefined,
): string | null => {
  if (!admin) return null
  if (isSuperAdmin(admin.username) || hasAllPermissions(admin.permissions)) {
    return ADMIN_PERMISSIONS.find(p => p.routes.length)?.routes[0] || null
  }
  const perms = Array.isArray(admin.permissions) ? admin.permissions : []
  const match = ADMIN_PERMISSIONS.find(p => perms.includes(p.code) && p.routes.length)
  return match?.routes[0] || null
}

export const useAdminPermissions = () => {
  const { locale } = useI18n()
  const adminRef = ref<any>(null)

  const loadAdmin = async () => {
    try {
      const res: any = await $fetch('/api/admin/session', { method: 'GET' })
      adminRef.value = res?.admin || null
    } catch (e) {
      adminRef.value = null
    }
  }

  const permissions = computed(() => adminRef.value?.permissions as string[] | undefined)
  const isSuper = computed(() => isSuperAdmin(adminRef.value?.username))
  const allPermissions = computed(() => hasAllPermissions(permissions.value))

  const hasPerm = (code: string) => adminHasPermission(adminRef.value, code)

  const labelFor = (def: AdminPermissionDef) =>
    (locale.value || 'en').startsWith('zh') ? def.labelZh : def.label

  return {
    admin: adminRef,
    permissions,
    isSuper,
    allPermissions,
    loadAdmin,
    hasPerm,
    labelFor,
  }
}
