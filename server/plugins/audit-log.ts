import type { H3Event } from 'h3'
import { getRequestPath, getMethod, getHeader, getRequestIP } from 'h3'
import {
  ADMIN_API_PREFIX,
  describeAdminApiPath,
  getAuditMeta,
  getParsedRequestBody,
  recordOperation,
} from '../utils/auditLog'

// Reads leave no trace to audit; everything else on /api/admin is captured.
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Instrumented by hand inside the handlers instead — the acting identity is
// only known there (login establishes it, logout has already cleared it).
const MANUALLY_AUDITED_PATHS = new Set([
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/setup',
])

const RECORDED_FLAG = '__auditRecorded'

const capture = async (event: H3Event, error?: any) => {
  const context = event.context as Record<string, any>
  // The success and error paths are mutually exclusive in practice, but a
  // double-record would be worse than a missed one — guard anyway.
  if (context[RECORDED_FLAG]) return
  context[RECORDED_FLAG] = true

  const path = getRequestPath(event)
  if (!path.startsWith(ADMIN_API_PREFIX)) return

  const method = (getMethod(event) || 'GET').toUpperCase()
  if (!AUDITED_METHODS.has(method)) return

  // Compare without the query string so `?foo=1` can't bypass the skip list.
  const pathname = path.split('?')[0]!
  if (MANUALLY_AUDITED_PATHS.has(pathname)) return

  const meta = getAuditMeta(event)
  if (meta?.skip) return

  const admin = context.admin
  // No authenticated admin means an anonymous 401 — unattributable, and pure
  // noise from bots probing the admin API. The auth middleware puts the admin
  // on the context *before* its permission check, so a rejected 403 from a
  // real account still reaches here and gets recorded.
  if (!admin?.id && !meta?.actor?.id) return

  const derived = describeAdminApiPath(pathname, method)
  const statusCode = error?.statusCode || event.node?.res?.statusCode || 200
  const errorMessage = error
    ? error.statusMessage || error.message || String(error)
    : null

  const details = meta?.details !== undefined
    ? meta.details
    : { body: getParsedRequestBody(event), ...(errorMessage ? { error: errorMessage } : {}) }

  await recordOperation({
    actorType: meta?.actor?.type || 'admin',
    actorId: meta?.actor?.id ?? admin?.id ?? null,
    actorName: meta?.actor?.name ?? admin?.username ?? null,
    action: meta?.action || derived.action,
    resource: meta?.resource || derived.resource,
    resourceId: meta?.resourceId ?? derived.resourceId,
    summary: meta?.summary ?? null,
    details,
    path: pathname,
    method,
    statusCode,
    ip: getRequestIP(event, { xForwardedFor: true }) || null,
    userAgent: getHeader(event, 'user-agent')?.slice(0, 500) || null,
  })
}

export default defineNitroPlugin((nitroApp) => {
  // Successful operations.
  nitroApp.hooks.hook('afterResponse', async (event) => {
    await capture(event)
  })

  // Failed and denied ones. These never reach `afterResponse`: Nitro's error
  // handler writes the response itself and sets `event.handled`, which makes
  // h3's toNodeListener return before it fires the response hooks. Rejected
  // 403s are exactly the records worth keeping, so hook the error path too.
  nitroApp.hooks.hook('error', async (error: any, context: any) => {
    const event = context?.event
    if (!event) return
    await capture(event, error)
  })
})
