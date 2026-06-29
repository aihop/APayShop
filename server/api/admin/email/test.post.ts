import { sendEmail } from '../../../utils/email'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { to, templateCode, locale, templates } = body

  if (!to || !templateCode) {
    throw createError({ statusCode: 400, message: 'to and templateCode are required' })
  }

  const result = await sendEmail({
    to,
    templateCode,
    locale,
    templates,
    variables: {
      nickname: 'Test User',
      site_name: 'APayShop',
      verify_link: 'https://example.com/verify?token=test',
      order_id: 'TEST-001',
      amount: '99.00',
      product_name: 'Test Product',
      expire_date: new Date().toISOString().split('T')[0],
      plan_name: 'Pro Plan',
    },
  })

  return result
})
