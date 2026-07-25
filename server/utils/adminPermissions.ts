export interface AdminPermissionDef {
  code: string
  apiPrefixes: string[]
}

export const ADMIN_PERMISSIONS: AdminPermissionDef[] = [
  { code: 'dashboard', apiPrefixes: ['dashboard', 'stats'] },
  { code: 'products', apiPrefixes: ['products'] },
  { code: 'orders', apiPrefixes: ['orders'] },
  { code: 'payments', apiPrefixes: ['payments'] },
  { code: 'customers', apiPrefixes: ['customers'] },
  { code: 'cards', apiPrefixes: ['cards'] },
  { code: 'subscriptions', apiPrefixes: ['subscriptions'] },
  { code: 'posts', apiPrefixes: ['posts'] },
  { code: 'promo', apiPrefixes: ['promo'] },
  { code: 'logs', apiPrefixes: ['logs', 'access-logs'] },
  { code: 'settings', apiPrefixes: ['settings', 'setup', 'email', 'event-rules'] },
  { code: 'admins', apiPrefixes: ['admins'] },
  { code: 'system', apiPrefixes: ['system', 'upload', 'scheduler'] },
]

export const ADMIN_PERMISSION_CODE_SET = new Set(ADMIN_PERMISSIONS.map(p => p.code))

const PREFIX_TO_PERMISSION: Record<string, string> = {}
for (const p of ADMIN_PERMISSIONS) {
  for (const prefix of p.apiPrefixes) {
    PREFIX_TO_PERMISSION[prefix] = p.code
  }
}

export const isSuperAdmin = (username: string | null | undefined) => username === 'admin'

export const hasAllPermissions = (permissions: string[] | null | undefined) =>
  !permissions || permissions.length === 0 || permissions.includes('*')

export const adminHasPermission = (
  admin: { username?: string | null; permissions?: string[] | null } | null | undefined,
  permissionCode: string,
): boolean => {
  if (!admin) return false
  if (isSuperAdmin(admin.username)) return true
  if (hasAllPermissions(admin.permissions)) return true
  return Array.isArray(admin.permissions) && admin.permissions.includes(permissionCode)
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
    if (ADMIN_PERMISSION_CODE_SET.has(trimmed)) {
      if (!result.includes(trimmed)) result.push(trimmed)
    }
  }
  if (result.includes('*')) return ['*']
  return result.length ? result : null
}
