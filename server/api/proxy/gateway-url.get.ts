import { defineEventHandler } from 'h3'
import { getAIGatewayUrl } from '../../utils/externalProxy'

export default defineEventHandler(async () => {
  const url = await getAIGatewayUrl()
  return { url }
})
