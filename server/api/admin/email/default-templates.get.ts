import { getQuery } from 'h3'
import { defaultEmailTemplates } from '../../../data/defaultEmailTemplates'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locale = String(query.locale || '').trim().toLowerCase()

  if (!locale || locale === 'all') {
    return defaultEmailTemplates
  }

  const localizedTemplates = defaultEmailTemplates.filter((template) => template.code.endsWith(`-${locale}`))

  return localizedTemplates
})
