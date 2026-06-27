// ====== Bird (MessageBird) Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }

const res = await fetch('https://api.bird.com/v1/workspaces/' + config.workspaceId + '/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bird ${config.apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    originator: config.from || 'Your Company',
    recipients: [{ to }],
    subject: subject,
    body: {
      type: 'html',
      html: html
    }
  })
})

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.id }
}

const errText = await res.text()
console.error('Bird API error:', errText)
return { ok: false, error: errText }
