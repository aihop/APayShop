// ====== Bird (MessageBird) Email Send Script (Sandbox) ======
// Sandbox exposes: { to, subject, html, config, fetch, crypto, console }
//
// Required config fields:
//   apiKey      - Bird Access Key
//   workspaceId - Workspace UUID
//   channelId   - Email Channel UUID (get from Bird Dashboard → Manage Channels → Email → Channel ID)
//   fromName    - Optional display name for the sender

const url = 'https://api.bird.com/workspaces/' + config.workspaceId + '/channels/' + config.channelId + '/messages'

const payload = {
  receiver: {
    contacts: [
      {
        identifierKey: 'emailaddress',
        identifierValue: to
      }
    ]
  },
  body: {
    type: 'html',
    html: {
      html: html,
      text: subject,
      metadata: {
        subject: subject
      }
    }
  }
}

// Optional sender display name
if (config.fromName) {
  payload.body.html.metadata.emailFrom = {
    displayName: config.fromName
  }
}

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'AccessKey ' + config.apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.id }
}

const errText = await res.text()
console.error('Bird API error:', errText)
return { ok: false, error: errText }
