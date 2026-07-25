export interface AdminPermissionDef {
  code: string
  apiPrefixes: string[]
}

export const ADMIN_PERMISSIONS: AdminPermissionDef[] = [
  { code: 'dashboard', apiPrefixes: ['dashboard'] },
  { code: 'stats', apiPrefixes: ['stats'] },
  { code: 'products', apiPrefixes: ['products'] },
  { code: 'orders', apiPrefixes: ['orders'] },
  { code: 'payments', apiPrefixes: ['payments'] },
  { code: 'customers', apiPrefixes: ['customers', 'users'] },
  { code: 'cards', apiPrefixes: ['cards'] },
  { code: 'subscriptions', apiPrefixes: ['subscriptions'] },
  { code: 'posts', apiPrefixes: ['posts'] },
  { code: 'promo', apiPrefixes: ['promo'] },
  { code: 'logs', apiPrefixes: ['logs', 'access-logs', 'operation-logs'] },
  { code: 'settings', apiPrefixes: ['settings', 'setup', 'email', 'event-rules'] },
  { code: 'admins', apiPrefixes: ['admins'] },
  { code: 'system', apiPrefixes: ['system', 'upload', 'scheduler'] },
]

const VIEW_SUFFIX = ':view'
const EDIT_SUFFIX = ':edit'
export const moduleViewCode = (code: string) => `${code}${VIEW_SUFFIX}`
export const moduleEditCode = (code: string) => `${code}${EDIT_SUFFIX}`

export const ADMIN_PERMISSION_CODE_SET = new Set(ADMIN_PERMISSIONS.map(p => p.code))
// Every module additionally accepts a '<code>:view' / '<code>:edit' tiered
// grant (see adminHasPermission). Kept as a separate set — bare module codes
// remain valid too, as the legacy pre-tiering meaning of "full access".
export const ADMIN_TIERED_PERMISSION_CODE_SET = new Set(
  ADMIN_PERMISSIONS.flatMap(p => [`${p.code}${VIEW_SUFFIX}`, `${p.code}${EDIT_SUFFIX}`])
)

// Theme extension pages (theme.admin.json) are dynamic per active theme —
// one namespaced permission code per page, minted client-side by
// themeExtensionPermissionCode() in app/composables/useAdminPermissions.ts.
// The server doesn't (and shouldn't) need to know each theme's page list to
// validate these: the code never gates an /api/admin/* route (extension
// APIs live outside that prefix, under each theme's own auth), so an
// unmapped/stale "ext:<theme>:<key>" is inert — it just won't match any
// route or nav entry on the client. We only need to recognize the shape so
// normalizePermissions doesn't silently strip it when an admin is saved.
const THEME_EXTENSION_PERMISSION_PATTERN = /^ext:[a-z0-9_-]+:[a-z0-9_-]+$/i
export const isThemeExtensionPermissionCode = (code: string): boolean =>
  THEME_EXTENSION_PERMISSION_PATTERN.test(code)

const PREFIX_TO_PERMISSION: Record<string, string> = {}
for (const p of ADMIN_PERMISSIONS) {
  for (const prefix of p.apiPrefixes) {
    PREFIX_TO_PERMISSION[prefix] = p.code
  }
}

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

export const ADMIN_PUBLIC_PATHS = new Set([
  '/api/admin/setup',
  '/api/admin/setup/check',
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/profile',
  '/api/admin/session',
])

export const matchPermissionForApiPath = (apiPath: string): string | null => {
  if (!apiPath.startsWith('/api/admin/')) return null
  const rest = apiPath.slice('/api/admin/'.length)
  const parts = rest.split('/')
  const first = parts[0]
  if (!first) return null
  return PREFIX_TO_PERMISSION[first] || null
}

export const normalizePermissions = (
  input: unknown,
  opts: { allowAll?: boolean } = {},
): string[] | null => {
  if (input === null || input === undefined) return null
  if (!Array.isArray(input)) return null
  const result: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    if (opts.allowAll && trimmed === '*') {
      result.push('*')
      continue
    }
    if (
      ADMIN_PERMISSION_CODE_SET.has(trimmed) ||
      ADMIN_TIERED_PERMISSION_CODE_SET.has(trimmed) ||
      isThemeExtensionPermissionCode(trimmed)
    ) {
      if (!result.includes(trimmed)) result.push(trimmed)
    }
  }
  if (result.includes('*')) return ['*']
  // Preserve an explicit empty array as "no permissions" — collapsing it to
  // null would make hasAllPermissions() treat it as full access.
  return result
}
