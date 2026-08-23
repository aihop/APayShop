
import { decryptCredential, encryptCredential, credentialPreview } from './crypto'
import { getProvider, listProviders } from './providers'
import { listConnections, saveConnections, toPublicConnection } from './storage'
import { SAAS_ADMIN_PERMISSION, type StoredSaasConnection } from './types'
import type { H3Event } from 'h3'
import { recordOperationFromEvent } from '~~/server/utils/auditLog'

const API_PREFIX = '/api/saas-control-plane/admin'

const requireSaasAdmin = (event: H3Event) => {
  const admin = event.context.admin as { username?: string; permissions?: string[] | null } | undefined
  if (!admin) throw createError({ statusCode: 401, statusMessage: 'Admin access required' })
  const permissions = admin.permissions
  const allowed = admin.username === 'admin'
    || !permissions
    || permissions.includes('*')
    || permissions.includes(SAAS_ADMIN_PERMISSION)
  if (!allowed) throw createError({ statusCode: 403, statusMessage: `Requires permission ${SAAS_ADMIN_PERMISSION}` })
  return admin
}

const requireConnectionAdmin = (event: H3Event) => {
  const admin = requireSaasAdmin(event)
  const permissions = admin.permissions
  const allowed = admin.username === 'admin'
    || !permissions
    || permissions.includes('*')
    || permissions.includes('settings')
    || permissions.includes('settings:edit')
  if (!allowed) throw createError({ statusCode: 403, statusMessage: 'Requires permission settings:edit' })
  return admin
}

const auditConnection = async (
  event: H3Event,
  action: string,
  connection: Pick<StoredSaasConnection, 'id' | 'name' | 'provider' | 'baseUrl'>,
  statusCode = 200,
) => {
  const admin = event.context.admin as { id?: number; username?: string } | undefined
  await recordOperationFromEvent(event, {
    actorType: 'admin',
    actorId: admin?.id ?? null,
    actorName: admin?.username ?? null,
    action,
    resource: 'saas_provider_connection',
    resourceId: connection.id,
    summary: `${action} SaaS provider connection ${connection.name}`,
    details: {
      name: connection.name,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
    },
    statusCode,
  })
}

const normalizeBaseUrl = (value: unknown) => {
  let url: URL
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'A valid provider base URL is required' })
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw createError({ statusCode: 400, statusMessage: 'Provider URL must be a plain HTTP(S) origin or path' })
  }
  const hostname = url.hostname.toLowerCase()
  const allowPrivate = process.env.APAY_SAAS_ALLOW_PRIVATE_NETWORK === 'true'
  const privateHost = hostname === 'localhost'
    || hostname.endsWith('.local')
    || hostname === '::1'
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  if (privateHost && !allowPrivate) {
    throw createError({ statusCode: 400, statusMessage: 'Private provider hosts require APAY_SAAS_ALLOW_PRIVATE_NETWORK=true' })
  }
  return url.toString().replace(/\/$/, '')
}

const requireText = (value: unknown, field: string, maxLength = 120) => {
  const result = String(value || '').trim()
  if (!result || result.length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${field} is required and must be at most ${maxLength} characters` })
  }
  return result
}

const credentialKey = (event: H3Event) => String(useRuntimeConfig(event).saasControlPlaneCredentialKey || '')

const resolveConnection = async (event: H3Event) => {
  const connections = await listConnections()
  const requestedId = getQuery(event).connectionId
  const connection = requestedId
    ? connections.find(item => item.id === String(requestedId))
    : connections.find(item => item.isDefault) || connections[0]
  if (!connection) throw createError({ statusCode: 404, statusMessage: 'No SaaS provider connection is configured' })
  if (!connection.enabled) throw createError({ statusCode: 409, statusMessage: 'The selected SaaS connection is disabled' })
  const credential = await decryptCredential(connection.secret, credentialKey(event))
  return { connection, credential, provider: getProvider(connection.provider) }
}

const saveConnection = async (event: H3Event, id?: string) => {
  const body = await readBody<Record<string, unknown>>(event)
  const connections = await listConnections()
  const existingIndex = id ? connections.findIndex(item => item.id === id) : -1
  if (id && existingIndex < 0) throw createError({ statusCode: 404, statusMessage: 'SaaS connection not found' })

  const existing = existingIndex >= 0 ? connections[existingIndex]! : null
  const provider = requireText(body.provider ?? existing?.provider, 'provider', 40)
  getProvider(provider)
  const suppliedSecret = String(body.secret || '').trim()
  if (!existing && !suppliedSecret) throw createError({ statusCode: 400, statusMessage: 'Credential is required' })
  const normalizedBaseUrl = normalizeBaseUrl(body.baseUrl ?? existing?.baseUrl)
  if (existing && normalizedBaseUrl !== existing.baseUrl && !suppliedSecret) {
    throw createError({ statusCode: 400, statusMessage: 'Credential must be re-entered when the provider URL changes' })
  }

  const now = new Date().toISOString()
  const isDefault = Boolean(body.isDefault ?? existing?.isDefault ?? connections.length === 0)
  const connection: StoredSaasConnection = {
    id: existing?.id || crypto.randomUUID(),
    name: requireText(body.name ?? existing?.name, 'name'),
    provider,
    baseUrl: normalizedBaseUrl,
    secret: suppliedSecret ? await encryptCredential(suppliedSecret, credentialKey(event)) : existing!.secret,
    secretPreview: suppliedSecret ? credentialPreview(suppliedSecret) : existing!.secretPreview,
    enabled: Boolean(body.enabled ?? existing?.enabled ?? true),
    isDefault,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  if (isDefault) connections.forEach(item => { item.isDefault = false })
  if (existingIndex >= 0) connections[existingIndex] = connection
  else connections.push(connection)
  if (!connections.some(item => item.isDefault) && connections.length) connections[0]!.isDefault = true
  await saveConnections(connections)
  return toPublicConnection(connection)
}

export default defineEventHandler(async (event) => {
  requireSaasAdmin(event)
  const pathname = getRequestURL(event).pathname
  const path = pathname.slice(API_PREFIX.length).replace(/^\/+|\/+$/g, '')
  const method = (event.method || 'GET').toUpperCase()

  if (method === 'GET' && path === 'providers') return { providers: listProviders() }
  if (method === 'GET' && path === 'connections') {
    return { connections: (await listConnections()).map(toPublicConnection) }
  }
  if (method === 'POST' && path === 'connections') {
    requireConnectionAdmin(event)
    const connection = await saveConnection(event)
    await auditConnection(event, 'create', connection)
    return { connection }
  }

  const connectionMatch = path.match(/^connections\/([^/]+)(?:\/(test))?$/)
  if (connectionMatch) {
    const id = decodeURIComponent(connectionMatch[1]!)
    if (method === 'PUT' && !connectionMatch[2]) {
      requireConnectionAdmin(event)
      const connection = await saveConnection(event, id)
      await auditConnection(event, 'update', connection)
      return { connection }
    }
    if (method === 'DELETE' && !connectionMatch[2]) {
      requireConnectionAdmin(event)
      const connections = await listConnections()
      const deleted = connections.find(item => item.id === id)
      if (!deleted) throw createError({ statusCode: 404, statusMessage: 'SaaS connection not found' })
      const next = connections.filter(item => item.id !== id)
      if (!next.some(item => item.isDefault) && next.length) {
        const nextDefault = next.find(item => item.enabled) || next[0]!
        nextDefault.isDefault = true
      }
      await saveConnections(next)
      await auditConnection(event, 'delete', deleted)
      return { success: true }
    }
    if (method === 'POST' && connectionMatch[2] === 'test') {
      requireConnectionAdmin(event)
      const connections = await listConnections()
      const connection = connections.find(item => item.id === id)
      if (!connection) throw createError({ statusCode: 404, statusMessage: 'SaaS connection not found' })
      const provider = getProvider(connection.provider)
      const credential = await decryptCredential(connection.secret, credentialKey(event))
      try {
        const result = await provider.test(connection, credential)
        await auditConnection(event, 'test', connection)
        return { result, checkedAt: new Date().toISOString() }
      } catch (error) {
        await auditConnection(event, 'test', connection, 502)
        throw error
      }
    }
  }

  const dataMatch = path.match(/^data\/(overview|tenants|plans|subscriptions)$/)
  if (method === 'GET' && dataMatch) {
    const resource = dataMatch[1] as 'overview' | 'tenants' | 'plans' | 'subscriptions'
    const { connection, credential, provider } = await resolveConnection(event)
    const query = getRequestURL(event).searchParams
    let data: unknown
    if (resource === 'overview') data = await provider.overview(connection, credential)
    else if (resource === 'tenants') data = await provider.tenants(connection, credential, query)
    else if (resource === 'plans') data = await provider.plans(connection, credential, query)
    else data = await provider.subscriptions(connection, credential, query)
    return {
      connection: { id: connection.id, name: connection.name, provider: connection.provider },
      data,
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'SaaS control-plane endpoint not found' })
})
