// ====== SMTP Email Send Script (Sandbox) ======
// NOTE: This script uses fetch to call a server-side SMTP relay endpoint.
// Direct SMTP from sandbox is not possible because we lack TCP socket access.
// 
// Option 1: Use a hosted SMTP-to-API bridge (e.g. your own tiny endpoint)
// Option 2: Use a service like smtp2go.com that offers a REST API
//
// This example uses smtp2go's REST API as a general SMTP relay:

const res = await fetch('https://api.smtp2go.com/v3/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Smtp2go-Api-Key': config.apiKey
  },
  body: JSON.stringify({
    sender: config.from || 'noreply@yourdomain.com',
    to: [to],
    subject: subject,
    html_body: html
  })
})

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.data?.email_id || 'sent' }
}

const errText = await res.text()
console.error('SMTP2GO API error:', errText)
return { ok: false, error: errText }
