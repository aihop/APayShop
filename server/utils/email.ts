import { emailProviders, emailLogs, settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import fs from 'fs'
import path from 'path'
import { defaultEmailTemplates } from '../data/defaultEmailTemplates'

export interface EmailSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

async function logEmailSend(data: {
  to: string
  subject: string
  templateCode?: string
  html?: string
  provider?: string
  status: 'success' | 'failed'
  messageId?: string
  error?: string
}) {
  try {
    await db.insert(emailLogs).values({
      to: data.to,
      subject: data.subject,
      templateCode: data.templateCode || null,
      html: data.html || null,
      provider: data.provider || null,
      status: data.status,
      messageId: data.messageId || null,
      error: data.error || null,
      createdAt: new Date(),
    })
  } catch (logErr) {
    console.error('[Email] Failed to persist email log:', logErr)
  }
}

// 与支付沙盒(sandbox.ts)同一套防护:只允许 http/https 协议与常规 HTTP 方法,
// 挡掉 file:// 等非常规协议访问本地文件系统(此前邮件沙盒直接暴露 globalThis.fetch,
// 无任何限制,与支付沙盒的 createSandboxFetch() 口径不一致)
function createSandboxFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url
    let url: URL
    try {
      url = new URL(urlString)
    } catch {
      throw new Error('sandbox fetch: invalid URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('sandbox fetch: only http/https protocols allowed')
    }
    const method = String(init?.method || 'GET').toUpperCase()
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    if (!allowedMethods.includes(method)) {
      throw new Error(`sandbox fetch: method ${method} not allowed`)
    }
    return globalThis.fetch(input, init)
  }
}

/**
 * Execute the email send script in a sandbox (same pattern as payment sandbox).
 * Exposes: { to, subject, html, config, fetch, crypto, console }
 */
export async function executeEmailScript(
  scriptCode: string,
  payload: { to: string; subject: string; html: string },
  configJson: any
): Promise<EmailSendResult> {
  try {
    const crypto = await import('crypto')
    const sandboxEnv = {
      payload,
      config: configJson,
      crypto: {
        md5: (str: string) => crypto.createHash('md5').update(str, 'utf8').digest('hex'),
        sha256: (str: string) => crypto.createHash('sha256').update(str, 'utf8').digest('hex'),
        hmacSha256: (str: string, key: string) =>
          crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex'),
        randomString: (length = 32) =>
          crypto.randomBytes(Math.max(16, Math.ceil(length / 2))).toString('hex').slice(0, length),
      },
      fetch: createSandboxFetch(),
      console: {
        log: (...args: any[]) => console.log('[Email Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Email Sandbox Error]', ...args),
      },
    }

    const wrapper = `
      return (async function(process, globalThis, global, require, module, exports, __dirname, __filename, Function, AsyncFunction) {
        const { config, crypto, fetch, console } = sandboxEnv;
        const { to, subject, html } = sandboxEnv.payload;

        ${scriptCode}

      })(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    `

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const fn = new AsyncFunction('sandboxEnv', wrapper)
    const result = await fn(sandboxEnv)

    if (!result || typeof result !== 'object') {
      throw new Error('Email script did not return a valid object')
    }

    return {
      ok: !!result.ok,
      messageId: result.messageId ? String(result.messageId) : undefined,
      error: result.error ? String(result.error) : undefined,
    }
  } catch (error: any) {
    console.error('Failed to execute email script:', error)
    return { ok: false, error: `Sandbox Error: ${error.message}` }
  }
}

interface EmailTemplate {
  code: string
  name: string
  subject: string
  variables: string[]
  html: string
}

/**
 * Send an email using a configured template and the active email provider.
 * Automatically falls back to built-in presets when custom templates are missing.
 */
export async function sendEmail(options: {
  to: string
  templateCode: string
  variables: Record<string, string>
  locale?: string
  templates?: string // optional inline JSON array of EmailTemplate, skips DB lookup
}): Promise<EmailSendResult> {
  let subject = `[${options.templateCode}]`
  let html = ''
  let providerName = 'custom'

  try {
    // 1. Load templates: custom from settings/inline + built-in presets fallback
    let templates: EmailTemplate[] = []

    if (options.templates) {
      try {
        templates = JSON.parse(options.templates)
      } catch {
        templates = []
      }
    } else {
      const templateSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'email_templates'))
        .limit(1)

      if (templateSetting.length > 0 && templateSetting[0].value) {
        try {
          templates = JSON.parse(templateSetting[0].value)
        } catch {
          templates = []
        }
      }
    }

    // Merge with built-in templates (custom overrides preset)
    const combinedTemplates = [...templates]
    const customCodes = new Set(templates.map((t) => t.code))
    for (const preset of defaultEmailTemplates) {
      if (!customCodes.has(preset.code)) {
        combinedTemplates.push(preset)
      }
    }

    // Locale-aware template lookup:
    // 1) requested locale (e.g. verify_email-zh)
    // 2) Chinese default (e.g. verify_email-zh)
    // 3) English default (e.g. verify_email-en)
    // 4) generic code (e.g. verify_email)
    const normalizedLocale = options.locale?.trim().toLowerCase() || ''
    const localeCode = normalizedLocale ? `${options.templateCode}-${normalizedLocale}` : null
    const zhLocaleCode = `${options.templateCode}-zh`
    const enLocaleCode = `${options.templateCode}-en`
    let tpl: EmailTemplate | undefined

    if (localeCode) {
      tpl = combinedTemplates.find((t) => t.code === localeCode)
    }
    if (!tpl && localeCode !== zhLocaleCode) {
      tpl = combinedTemplates.find((t) => t.code === zhLocaleCode)
    }
    if (!tpl && localeCode !== enLocaleCode) {
      tpl = combinedTemplates.find((t) => t.code === enLocaleCode)
    }
    if (!tpl) {
      tpl = combinedTemplates.find((t) => t.code === options.templateCode)
    }

    if (!tpl) {
      // Fallback to default template setting if configured
      const defaultSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'email_default_template'))
        .limit(1)

      const defaultCode = defaultSetting.length > 0 ? defaultSetting[0].value : null
      if (defaultCode && defaultCode !== '__none__') {
        tpl = combinedTemplates.find((t) => t.code === defaultCode)
      }

      if (!tpl) {
        const error = `Email template "${options.templateCode}"${localeCode ? ` (or "${localeCode}")` : ''} not found`
        await logEmailSend({
          to: options.to,
          subject,
          templateCode: options.templateCode,
          status: 'failed',
          error,
        })
        return { ok: false, error }
      }
    }

    // 2. Variable substitution
    html = tpl.html
    subject = tpl.subject
    for (const [key, value] of Object.entries(options.variables)) {
      html = html.replaceAll(`{{${key}}}`, value)
      subject = subject.replaceAll(`{{${key}}}`, value)
    }

    // 3. Find active email provider or fallback
    const activeProviders = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.isActive, true))
      .limit(1)

    let sendScript = ''
    let configJson: any = {}
    let providerCode = ''

    if (activeProviders.length > 0) {
      const active = activeProviders[0]
      providerCode = active.code || 'resend'
      providerName = active.name || providerCode
      sendScript = active.sendScript?.trim() || ''
      if (active.configJson) {
        try {
          configJson = JSON.parse(active.configJson)
        } catch {
          configJson = {}
        }
      }
    } else {
      // If no active provider in DB, check settings
      const [codeSetting, activeSetting] = await Promise.all([
        db.select().from(settings).where(eq(settings.key, 'email_provider_code')).limit(1),
        db.select().from(settings).where(eq(settings.key, 'email_provider_is_active')).limit(1),
      ])

      if (codeSetting.length > 0 && codeSetting[0].value) {
        providerCode = codeSetting[0].value
      } else {
        // Fallback: check any provider in DB
        const anyProvider = await db.select().from(emailProviders).limit(1)
        if (anyProvider.length > 0) {
          providerCode = anyProvider[0].code
          if (anyProvider[0].configJson) {
            try { configJson = JSON.parse(anyProvider[0].configJson) } catch {}
          }
          if (anyProvider[0].sendScript?.trim()) {
            sendScript = anyProvider[0].sendScript.trim()
          }
        }
      }

      providerName = providerCode || 'bird'
    }

    // If configJson is empty, try loading from settings table
    if (!configJson || Object.keys(configJson).length === 0) {
      const configSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'email_provider_config_json'))
        .limit(1)
      if (configSetting.length > 0 && configSetting[0].value) {
        try {
          configJson = JSON.parse(configSetting[0].value)
        } catch {
          configJson = {}
        }
      }
    }

    // Built-in email scripts map (guaranteed fallback across all runtimes)
    const BUILTIN_SCRIPTS: Record<string, string> = {
      bird: `const url = 'https://api.bird.com/workspaces/' + config.workspaceId + '/channels/' + config.channelId + '/messages';
const payload = {
  receiver: { contacts: [{ identifierKey: 'emailaddress', identifierValue: to }] },
  body: { type: 'html', html: { html: html, text: subject, metadata: { subject: subject } } }
};
if (config.fromName) { payload.body.html.metadata.emailFrom = { displayName: config.fromName }; }
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': 'AccessKey ' + config.apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
if (res.ok) { const data = await res.json(); return { ok: true, messageId: data.id }; }
const errText = await res.text();
console.error('Bird API error:', errText);
return { ok: false, error: errText };`,
      resend: `const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: config.from || 'noreply@yourdomain.com', to: [to], subject: subject, html: html })
});
if (res.ok) { const data = await res.json(); return { ok: true, messageId: data.id }; }
const errText = await res.text();
console.error('Resend API error:', errText);
return { ok: false, error: errText };`,
      sendgrid: `const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: config.from || 'noreply@yourdomain.com', name: config.fromName || '' }, subject: subject, content: [{ type: 'text/html', value: html }] })
});
if (res.status === 202) { return { ok: true, messageId: res.headers.get('x-message-id') || 'sent' }; }
const errText = await res.text();
console.error('SendGrid API error:', errText);
return { ok: false, error: errText };`,
      mailgun: `const formData = new URLSearchParams();
formData.append('from', config.from || 'noreply@yourdomain.com');
formData.append('to', to);
formData.append('subject', subject);
formData.append('html', html);
const res = await fetch('https://api.mailgun.net/v3/' + config.domain + '/messages', {
  method: 'POST',
  headers: { 'Authorization': 'Basic ' + btoa('api:' + config.apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: formData.toString()
});
if (res.ok) { const data = await res.json(); return { ok: true, messageId: data.id || 'sent' }; }
const errText = await res.text();
console.error('Mailgun API error:', errText);
return { ok: false, error: errText };`,
      postmark: `const res = await fetch('https://api.postmarkapp.com/email', {
  method: 'POST',
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': config.serverToken },
  body: JSON.stringify({ From: config.from || 'noreply@yourdomain.com', To: to, Subject: subject, HtmlBody: html, MessageStream: config.messageStream || 'outbound' })
});
if (res.ok) { const data = await res.json(); return { ok: true, messageId: data.MessageID }; }
const errText = await res.text();
console.error('Postmark API error:', errText);
return { ok: false, error: errText };`,
      smtp: `const res = await fetch('https://api.smtp2go.com/v3/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': config.apiKey },
  body: JSON.stringify({ sender: config.from || 'noreply@yourdomain.com', to: [to], subject: subject, html_body: html })
});
if (res.ok) { const data = await res.json(); return { ok: true, messageId: data.data?.email_id || 'sent' }; }
const errText = await res.text();
console.error('SMTP2GO API error:', errText);
return { ok: false, error: errText };`,
    }

    if (!sendScript && providerCode && BUILTIN_SCRIPTS[providerCode]) {
      sendScript = BUILTIN_SCRIPTS[providerCode]
    }

    // Fallback to local files if any custom provider on disk
    if (!sendScript && providerCode) {
      const localScriptPath = path.join(process.cwd(), 'emails', providerCode, 'send.js')
      if (fs.existsSync(localScriptPath)) {
        sendScript = fs.readFileSync(localScriptPath, 'utf-8')
      }
    }

    if (!sendScript.trim()) {
      const error = 'No email provider configured. Add a provider in Settings → Email.'
      await logEmailSend({
        to: options.to,
        subject,
        templateCode: options.templateCode,
        html,
        provider: providerName,
        status: 'failed',
        error,
      })
      return { ok: false, error }
    }

    // 4. Execute sandbox
    const result = await executeEmailScript(
      sendScript,
      { to: options.to, subject, html },
      configJson
    )

    // 5. Persist log synchronously
    await logEmailSend({
      to: options.to,
      subject,
      templateCode: options.templateCode,
      html,
      provider: providerName,
      status: result.ok ? 'success' : 'failed',
      messageId: result.messageId,
      error: result.error,
    })

    return result
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error)
    await logEmailSend({
      to: options.to,
      subject: subject || `[Failed] ${options.templateCode}`,
      templateCode: options.templateCode,
      html,
      provider: providerName,
      status: 'failed',
      error: error.message,
    })
    return { ok: false, error: error.message }
  }
}
