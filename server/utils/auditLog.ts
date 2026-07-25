import type { H3Event } from 'h3'
import { operationLogs } from '../db/schema'
import { db } from '../db/runtime'

export type AuditActorType = 'admin' | 'user' | 'system'

export interface AuditActor {
  type?: AuditActorType
  id?: number | null
  name?: string | null
}

/**
 * Enrichment a handler can attach to the current request. The audit plugin
 * merges this over whatever it derived from the path/method, so a handler only
 * needs to supply the parts it wants to improve (a human summary, a before/after
 * diff, the real resource id when it isn't in the URL).
 */
export interface AuditMeta {
  action?: string
  resource?: string
  resourceId?: string | number | null
  summary?: string
  details?: unknown
  actor?: AuditActor
  /** Set to drop this request from the audit trail entirely. */
  skip?: boolean
}

export interface RecordOperationInput {
  actorType?: AuditActorType
  actorId?: number | null
  actorName?: string | null
  action: string
  resource: string
  resourceId?: string | number | null
  summary?: string | null
  details?: unknown
  path: string
  method: string
  statusCode?: number | null
  ip?: string | null
  userAgent?: string | null
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const REDACTED = '***'
const MAX_DEPTH = 6
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 500
const MAX_DETAILS_CHARS = 8000

// Matched against the key with separators stripped, so `api_key`, `apiKey` and
// `API-KEY` all collapse to the same `apikey` hint.
const SENSITIVE_KEY_HINTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'credential',
  'authorization',
  'cookie',
  'signature',
  'passwordhash',
]

const isSensitiveKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[_\-\s]/g, '')
  return SENSITIVE_KEY_HINTS.some(hint => normalized.includes(hint))
}

const truncateString = (value: string) => {
  // Data URIs (uploaded images pasted into a form) would otherwise dwarf the
  // rest of the record.
  if (/^data:[^;]+;base64,/i.test(value)) return `[base64 ${value.length} chars]`
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…[+${value.length - MAX_STRING_LENGTH}]`
    : value
}

const redact = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (depth >= MAX_DEPTH) return '[depth limit]'

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map(item => redact(item, depth + 1))
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`)
    return items
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}

    // Settings are stored as { key, value } rows, so the secret lives in a
    // generically named `value` field — decide by looking at its sibling key.
    const keyField = source.key
    const settingsSecret = typeof keyField === 'string' && isSensitiveKey(keyField)

    for (const [key, item] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED
        continue
      }
      if (settingsSecret && key === 'value') {
        result[key] = REDACTED
        continue
      }
      result[key] = redact(item, depth + 1)
    }
    return result
  }

  return undefined
}

export const redactSensitive = (value: unknown) => redact(value)

export const serializeAuditDetails = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  try {
    const serialized = JSON.stringify(redact(value))
    if (!serialized || serialized === '{}' || serialized === 'null') return null
    return serialized.length > MAX_DETAILS_CHARS
      ? `${serialized.slice(0, MAX_DETAILS_CHARS)}…[truncated]`
      : serialized
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Path → resource / action
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const looksLikeResourceId = (segment: string) => {
  if (/^\d+$/.test(segment)) return true
  if (UUID_PATTERN.test(segment)) return true
  if (segment.length >= 16) return true
  return segment.length >= 8 && /\d/.test(segment) && /^[A-Za-z0-9_-]+$/.test(segment)
}

const METHOD_ACTION: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

export const ADMIN_API_PREFIX = '/api/admin/'

/**
 * `/api/admin/products/12`        PUT    → products / update / 12
 * `/api/admin/orders/<uuid>`      PUT    → orders   / update / <uuid>
 * `/api/admin/products/reorder`   PUT    → products / reorder
 * `/api/admin/logs/clear`         DELETE → logs     / clear
 */
export const describeAdminApiPath = (path: string, method: string) => {
  const rest = path.startsWith(ADMIN_API_PREFIX)
    ? path.slice(ADMIN_API_PREFIX.length).split('/').filter(Boolean)
    : path.split('/').filter(Boolean)

  const resource = rest[0] || 'unknown'
  let resourceId: string | null = null
  const verbs: string[] = []

  for (const segment of rest.slice(1)) {
    if (!resourceId && looksLikeResourceId(segment)) resourceId = segment
    else verbs.push(segment)
  }

  const action = verbs.length > 0
    ? verbs.join('.')
    : METHOD_ACTION[method.toUpperCase()] || method.toLowerCase()

  return { resource, resourceId, action }
}

// ---------------------------------------------------------------------------
// Request-scoped helpers
// ---------------------------------------------------------------------------

const AUDIT_META_KEY = '__auditMeta'

/** Merge audit enrichment for the current request. Safe to call repeatedly. */
export const setAuditMeta = (event: H3Event, meta: AuditMeta) => {
  const context = event.context as Record<string, any>
  const existing = (context[AUDIT_META_KEY] || {}) as AuditMeta
  context[AUDIT_META_KEY] = {
    ...existing,
    ...meta,
    actor: meta.actor ? { ...existing.actor, ...meta.actor } : existing.actor,
  }
}

export const getAuditMeta = (event: H3Event): AuditMeta | undefined =>
  (event.context as Record<string, any>)[AUDIT_META_KEY]

/** Exclude the current request from the audit trail. */
export const skipAudit = (event: H3Event) => setAuditMeta(event, { skip: true })

// h3 caches the parsed body on the node request after the first readBody().
// Reading it back in `afterResponse` is the only way to see the payload without
// consuming the (already drained) stream a second time.
const PARSED_BODY_SYMBOL = Symbol.for('h3ParsedBody')

export const getParsedRequestBody = (event: H3Event): unknown => {
  try {
    const req = event.node?.req as any
    if (req && PARSED_BODY_SYMBOL in req) return req[PARSED_BODY_SYMBOL]
  } catch {
    // ignore
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/** Never throws: an audit failure must not take down the request it describes. */
export const recordOperation = async (input: RecordOperationInput) => {
  try {
    await db.insert(operationLogs).values({
      actorType: input.actorType || 'admin',
      actorId: input.actorId ?? null,
      actorName: input.actorName ? String(input.actorName).slice(0, 190) : null,
      action: String(input.action).slice(0, 64),
      resource: String(input.resource).slice(0, 64),
      resourceId: input.resourceId != null ? String(input.resourceId).slice(0, 190) : null,
      summary: input.summary ? String(input.summary).slice(0, 500) : null,
      details: serializeAuditDetails(input.details),
      path: input.path,
      method: String(input.method || '').toUpperCase().slice(0, 16),
      statusCode: input.statusCode ?? null,
      ip: input.ip ? String(input.ip).slice(0, 64) : null,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
      createdAt: new Date(),
    } as any)
  } catch (err) {
    console.error('[operation-log] Failed to record:', err)
  }
}

/**
 * Manual instrumentation for events the auto-capture plugin can't attribute —
 * chiefly the auth endpoints, where the acting identity is only known inside
 * the handler (login) or already cleared from context (logout).
 */
export const recordOperationFromEvent = async (
  event: H3Event,
  input: Omit<RecordOperationInput, 'path' | 'method' | 'ip' | 'userAgent'> & {
    path?: string
    method?: string
  },
) => {
  const { getRequestPath, getMethod, getHeader, getRequestIP } = await import('h3')
  await recordOperation({
    ...input,
    path: input.path || getRequestPath(event),
    method: input.method || getMethod(event) || 'POST',
    ip: getRequestIP(event, { xForwardedFor: true }) || null,
    userAgent: getHeader(event, 'user-agent')?.slice(0, 500) || null,
  })
}
