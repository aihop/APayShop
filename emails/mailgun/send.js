// ====== Mailgun Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }

const formData = new URLSearchParams()
formData.append('from', config.from || 'noreply@yourdomain.com')
formData.append('to', to)
formData.append('subject', subject)
formData.append('html', html)

const auth = 'Basic ' + btoa(`api:${config.apiKey}`)

const res = await fetch(
  `https://api.mailgun.net/v3/${config.domain}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  }
)

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.id || 'sent' }
}

const errText = await res.text()
console.error('Mailgun API error:', errText)
return { ok: false, error: errText }
