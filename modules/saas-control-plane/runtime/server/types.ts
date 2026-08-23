
export const SAAS_ADMIN_PERMISSION = 'ext:saas-control-plane:dashboard'
export const SAAS_CONNECTIONS_SETTING_KEY = 'module.saas_control_plane.connections.v1'

export type SaasCapability = 'overview' | 'tenants' | 'plans' | 'subscriptions'

export interface StoredSaasConnection {
  id: string
  name: string
  provider: string
  baseUrl: string
  secret: string
  secretPreview: string
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicSaasConnection extends Omit<StoredSaasConnection, 'secret'> {
  secretConfigured: boolean
}

export interface SaasListResult<T> {
  list: T[]
  total: number
}

export interface SaasProvider {
  code: string
  name: string
  capabilities: SaasCapability[]
  test(connection: StoredSaasConnection, credential: string): Promise<{ message: string }>
  overview(connection: StoredSaasConnection, credential: string): Promise<Record<string, unknown>>
  tenants(connection: StoredSaasConnection, credential: string, query: URLSearchParams): Promise<SaasListResult<Record<string, unknown>>>
  plans(connection: StoredSaasConnection, credential: string, query: URLSearchParams): Promise<SaasListResult<Record<string, unknown>>>
  subscriptions(connection: StoredSaasConnection, credential: string, query: URLSearchParams): Promise<SaasListResult<Record<string, unknown>>>
}
