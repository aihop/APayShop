import { defineEventHandler } from 'h3'
import { proxyExternalRequest } from '../../utils/externalProxy'

export default defineEventHandler(async (event) => {
  return await proxyExternalRequest(event, {
    requireSession: true,
    proxyLabel: 'Proxy',
    userAgent: 'APayShop-Proxy/1.0',
  })
})
