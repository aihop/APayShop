export interface AdminPermissionDef {
  code: string
  label: string
  labelZh: string
  apiPrefixes: string[]
  routes: string[]
  // Whether this module has any mutating action at all. Read-only modules
  // (dashboard, subscriptions) only ever need ":view" — no ":edit" checkbox
  // is rendered for them in the admin-management UI.
  editable?: boolean
}

export const ADMIN_PERMISSIONS: AdminPermissionDef[] = [
  {
    code: 'dashboard',
    label: 'Dashboard',
    labelZh: '仪表盘',
    apiPrefixes: ['dashboard'],
    routes: ['/admin/dashboard', '/admin'],
    editable: false,
  },
  {
    code: 'stats',
    label: 'Statistics',
    labelZh: '访客统计',
    apiPrefixes: ['stats'],
    routes: ['/admin/stats'],
    editable: true,
  },
  {
    code: 'products',
    label: 'Products Management',
    labelZh: '商品管理',
    apiPrefixes: ['products'],
    routes: ['/admin/products'],
    editable: true,
  },
  {
    code: 'orders',
    label: 'Orders Management',
    labelZh: '订单管理',
    apiPrefixes: ['orders'],
    routes: ['/admin/orders'],
    editable: true,
  },
  {
    code: 'payments',
    label: 'Payments Management',
    labelZh: '支付管理',
    apiPrefixes: ['payments'],
    routes: ['/admin/payments'],
    editable: true,
  },
  {
    code: 'customers',
    label: 'Customers Management',
    labelZh: '客户管理',
    apiPrefixes: ['customers', 'users'],
    routes: ['/admin/customers'],
    editable: true,
  },
  {
    code: 'cards',
    label: 'Cards / Codes Management',
    labelZh: '卡密管理',
    apiPrefixes: ['cards'],
    routes: ['/admin/cards'],
    editable: true,
  },
  {
    code: 'subscriptions',
    label: 'Subscriptions Management',
    labelZh: '订阅管理',
    apiPrefixes: ['subscriptions'],
    routes: ['/admin/subscriptions'],
    editable: false,
  },
  {
    code: 'posts',
    label: 'Posts / Blog Management',
    labelZh: '文章管理',
    apiPrefixes: ['posts'],
    routes: ['/admin/posts'],
    editable: true,
  },
  {
    code: 'promo',
    label: 'Promo & Affiliate System',
    labelZh: '推广体系',
    apiPrefixes: ['promo'],
    routes: ['/admin/promo'],
    editable: true,
  },
  {
    code: 'logs',
    label: 'Logs & Access Records',
    labelZh: '日志查询',
    apiPrefixes: ['logs', 'access-logs'],
    routes: ['/admin/logs'],
    editable: true,
  },
  {
    code: 'settings',
    label: 'System Settings',
    labelZh: '系统设置',
    apiPrefixes: ['settings', 'setup', 'email', 'event-rules'],
    routes: ['/admin/settings', '/admin/settings/themes'],
    editable: true,
  },
  {
    code: 'admins',
    label: 'Admins Management',
    labelZh: '管理员管理',
    apiPrefixes: ['admins'],
    routes: ['/admin/settings/manages'],
    editable: true,
  },
  {
    code: 'system',
    label: 'System Operations (Rebuild, Upload, Scheduler)',
    labelZh: '系统操作（重建、上传、调度）',
    apiPrefixes: ['system', 'upload', 'scheduler'],
    routes: [],
    editable: true,
  },
]

export const ADMIN_PERMISSION_MAP: Record<string, AdminPermissionDef> =
  Object.fromEntries(ADMIN_PERMISSIONS.map(p => [p.code, p]))

const VIEW_SUFFIX = ':view'
const EDIT_SUFFIX = ':edit'
export const moduleViewCode = (code: string) => `${code}${VIEW_SUFFIX}`
export const moduleEditCode = (code: string) => `${code}${EDIT_SUFFIX}`

// Theme extension pages (theme.admin.json) are dynamic per active theme, so
// they can't live in the static ADMIN_PERMISSIONS array above — instead each
// page gets its own namespaced code, one permission per page, built from the
// live manifest (see useAdminExtensions). Must match the pattern the server
// accepts in server/utils/adminPermissions.ts (isThemeExtensionPermissionCode).
export const themeExtensionPermissionCode = (theme: string, key: string) => `ext:${theme}:${key}`

export interface ThemeExtensionPageLike {
  key: string
  title: string
  route: string
  icon?: string
}

export const buildThemeExtensionPermissionDefs = (
  theme: string,
  pages: ThemeExtensionPageLike[],
): AdminPermissionDef[] =>
  pages.map(page => ({
    code: themeExtensionPermissionCode(theme, page.key),
    label: page.title,
    labelZh: page.title,
    apiPrefixes: [],
    routes: [page.route],
  }))

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
  const perms = Array.isArray(admin.permissions) ? admin.permissions : []
  if (perms.includes(permissionCode)) return true

  if (permissionCode.endsWith(EDIT_SUFFIX)) {
    // A legacy bare module grant (predates the view/edit split) always meant
    // full access to that module — never break an existing grant.
    const baseCode = permissionCode.slice(0, -EDIT_SUFFIX.length)
    return perms.includes(baseCode)
  }
  if (permissionCode.endsWith(VIEW_SUFFIX)) {
    const baseCode = permissionCode.slice(0, -VIEW_SUFFIX.length)
    // "edit" implies "view"; a legacy bare grant implies both.
    return perms.includes(baseCode) || perms.includes(`${baseCode}${EDIT_SUFFIX}`)
  }
  // A bare code was queried (module nav/route check, or a theme extension
  // code like "ext:theme:key") = "does this admin have ANY tier of access".
  return perms.some(p => p === `${permissionCode}${VIEW_SUFFIX}` || p === `${permissionCode}${EDIT_SUFFIX}`)
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
  extraDefs: AdminPermissionDef[] = [],
): boolean => {
  if (!admin) return false
  if (isSuperAdmin(admin.username)) return true
  if (hasAllPermissions(admin.permissions)) return true
  // Page access only requires SOME tier of the module (view or edit) — the
  // stored permission array holds tiered codes like "orders:edit", not the
  // bare module code, so route matching goes through adminHasPermission()
  // rather than a direct array lookup.
  const allowed: Set<string> = new Set()
  for (const def of [...ADMIN_PERMISSIONS, ...extraDefs]) {
    if (adminHasPermission(admin, def.code)) {
      for (const r of def.routes) allowed.add(r)
    }
  }
  if (allowed.has(path)) return true
  for (const r of allowed) {
    // '/admin' (the dashboard root) is a prefix of every other admin route.
    // Only match it exactly (handled above) — never as a startsWith prefix,
    // or "dashboard" permission alone would unlock the entire admin area.
    if (r === '/admin') continue
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
  extraDefs: AdminPermissionDef[] = [],
): string | null => {
  if (!admin) return null
  if (isSuperAdmin(admin.username) || hasAllPermissions(admin.permissions)) {
    return ADMIN_PERMISSIONS.find(p => p.routes.length)?.routes[0] || null
  }
  const match = [...ADMIN_PERMISSIONS, ...extraDefs].find(p => p.routes.length && adminHasPermission(admin, p.code))
  return match?.routes[0] || null
}

// The shared admin session state, deliberately kept free of any composable
// that requires a Vue component setup context (useI18n() in particular:
// vue-i18n throws "Must be called at the top of a `setup` function" if it's
// invoked anywhere else). Route middleware is NOT a component setup — it's
// a plain async function — so admin-auth.global.ts calls this directly
// rather than the full useAdminPermissions() below, which layers useI18n()
// (needed only for labelFor(), which only actual page/component code uses)
// on top of this same state.
export const useAdminSession = () => {
  // Shared across every call site (useState, not a local ref) — button-level
  // permission checks are sprinkled across many independent page components,
  // and each one calling this must see the SAME loaded admin, not silently
  // read an unpopulated local copy of its own.
  const adminRef = useState<any>('admin-permissions-session', () => null)
  const loadedRef = useState<boolean>('admin-permissions-loaded', () => false)

  const loadAdmin = async (force = false) => {
    if (loadedRef.value && !force) return
    try {
      // Server-side $fetch is an outgoing request from the Node process, not
      // the browser — it does NOT carry the original request's cookies
      // unless forwarded explicitly. Without this, every SSR render reads
      // back "not logged in" and every hasPerm() check silently fails closed.
      const res: any = await $fetch('/api/admin/session', {
        method: 'GET',
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
      })
      adminRef.value = res?.admin || null
    } catch (e) {
      adminRef.value = null
    } finally {
      loadedRef.value = true
    }
  }

  // Clears the shared state so a stale admin (from before a logout, or from
  // whoever was logged in before the current one in this same browser tab)
  // never leaks into the account that's active now. loadAdmin() is a
  // permanent cache once loaded — nothing else invalidates it automatically,
  // so login/logout must call this explicitly.
  const resetAdmin = () => {
    adminRef.value = null
    loadedRef.value = false
  }

  return { admin: adminRef, loadAdmin, resetAdmin }
}

export const useAdminPermissions = () => {
  const { locale } = useI18n()
  const { admin: adminRef, loadAdmin, resetAdmin } = useAdminSession()

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
    resetAdmin,
    hasPerm,
    labelFor,
  }
}
