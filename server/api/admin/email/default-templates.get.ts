import { defaultEmailTemplates } from '../../../data/defaultEmailTemplates'

export default defineEventHandler(async (event) => {
  return defaultEmailTemplates
})
