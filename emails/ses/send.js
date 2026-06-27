// ====== AWS SES Email Send Script (Sandbox) ======
// AWS Signature V4 signing is complex; this script uses a simpler approach:
// you MUST configure the AWS SDK or use IAM credentials.
// For Cloudflare Workers / edge runtime, consider using SES via HTTP API.
//
// Alternative: use a simple fetch-based approach with pre-signed URL
// or deploy a tiny Lambda proxy. For now, this script works in Node.js
// environments where the AWS SDK is available.

const cryptoModule = crypto

// AWS Signature V4 helper
async function signRequest(method, service, region, host, path, payload, accessKey, secretKey, sessionToken) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)

  const canonicalUri = path
  const canonicalQuerystring = ''
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-date'
  const payloadHash = cryptoModule.sha256(payload)

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${cryptoModule.sha256(canonicalRequest)}`

  const kDate = cryptoModule.hmacSha256(dateStamp, `AWS4${secretKey}`)
  const kRegion = cryptoModule.hmacSha256(region, kDate)
  const kService = cryptoModule.hmacSha256(service, kRegion)
  const kSigning = cryptoModule.hmacSha256('aws4_request', kService)
  const signature = cryptoModule.hmacSha256(stringToSign, kSigning)

  let authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  if (sessionToken) {
    authorization += `, X-Amz-Security-Token=${sessionToken}`
  }

  return { authorization, amzDate }
}

const region = config.region || 'us-east-1'
const host = `email.${region}.amazonaws.com`
const path = '/v2/email/outbound-emails'

const body = JSON.stringify({
  FromEmailAddress: config.from || 'noreply@yourdomain.com',
  Destination: { ToAddresses: [to] },
  Content: {
    Simple: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } }
    }
  }
})

const { authorization, amzDate } = await signRequest(
  'POST',
  'ses',
  region,
  host,
  path,
  body,
  config.accessKeyId,
  config.secretAccessKey,
  config.sessionToken || ''
)

const res = await fetch(`https://${host}${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    'Authorization': authorization
  },
  body
})

if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.MessageId }
}

const errText = await res.text()
console.error('SES API error:', errText)
return { ok: false, error: errText }
