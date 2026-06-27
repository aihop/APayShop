// ====== SendGrid Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }

const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: config.from || 'noreply@yourdomain.com', name: config.fromName || '' },
    subject: subject,
    content: [{ type: 'text/html', value: html }]
  })
})

if (res.status === 202) {
  return { ok: true, messageId: res.headers.get('x-message-id') || 'sent' }
}

const errText = await res.text()
console.error('SendGrid API error:', errText)
return { ok: false, error: errText }
