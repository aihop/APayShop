
import { shoplyProvider } from './shoply'
import type { SaasProvider } from '../types'

const providers: Record<string, SaasProvider> = {
  [shoplyProvider.code]: shoplyProvider,
}

export const listProviders = () => Object.values(providers).map(provider => ({
  code: provider.code,
  name: provider.name,
  capabilities: provider.capabilities,
}))

export const getProvider = (code: string) => {
  const provider = providers[code]
  if (!provider) throw createError({ statusCode: 400, statusMessage: `Unsupported SaaS provider: ${code}` })
  return provider
}
