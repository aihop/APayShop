import {
  getMinimalCheckoutAdminConfig,
  getMinimalCheckoutSecret,
} from '../../../../../app/themes/minimal/server/checkout/bridge'

export default defineEventHandler(async () => {
  const [config, secret] = await Promise.all([
    getMinimalCheckoutAdminConfig(),
    getMinimalCheckoutSecret(),
  ])

  return {
    secret: secret || '',
    hasSecret: Boolean(secret),
    ...config,
  }
})
