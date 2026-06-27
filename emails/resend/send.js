// ====== Resend Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
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

const errText = await res.text()
console.error('Resend API error:', errText)
return { ok: false, error: errText }
