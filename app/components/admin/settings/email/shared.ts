export interface EmailTemplate {
  code: string
  name: string
  subject: string
  variables: string[]
  html: string
}

export interface EmailTemplateDraft {
  code: string
  name: string
  subject: string
  variables: string[]
  html: string
}

export interface EmailTestResult {
  ok: boolean
  messageId?: string
  error?: string
}

export const DEFAULT_RESEND_SCRIPT = `// Sandbox: { to, subject, html, config, fetch, crypto, console }
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${config.apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: config.from || 'noreply@yourdomain.com',
    to: [to],
    subject: subject,
    html: html
  })
})
if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.id }
}
return { ok: false, error: await res.text() }`
