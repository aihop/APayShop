// ====== Postmark Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }

const res = await fetch('https://api.postmarkapp.com/email', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': config.serverToken
  },
  body: JSON.stringify({
    From: config.from || 'noreply@yourdomain.com',
    To: to,
    Subject: subject,
    HtmlBody: html,
    MessageStream: config.messageStream || 'outbound'
  })
})

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.MessageID }
}

const errText = await res.text()
console.error('Postmark API error:', errText)
return { ok: false, error: errText }
