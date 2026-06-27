import { emailProviders, settings } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import fs from 'fs'
import path from 'path'

export interface EmailSendResult {
  ok: boolean
  messageId?: string
  error?: string
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
      fetch: globalThis.fetch,
      console: {
        log: (...args: any[]) => console.log('[Email Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Email Sandbox Error]', ...args),
      },
    }

    const wrapper = `
      return (async function() {
        const { payload, config, crypto, fetch, console } = sandboxEnv;
        const { to, subject, html } = payload;

        ${scriptCode}

      })();
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
 * Templates are stored in settings.email_templates as a JSON array.
 */
export async function sendEmail(options: {
  to: string
  templateCode: string
  variables: Record<string, string>
}): Promise<EmailSendResult> {
  try {
    // 1. Load templates from settings
    const templateSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'email_templates'))
      .limit(1)

    if (!templateSetting.length || !templateSetting[0].value) {
      return { ok: false, error: 'No email templates configured (email_templates setting is empty)' }
    }

    let templates: EmailTemplate[]
    try {
      templates = JSON.parse(templateSetting[0].value)
    } catch {
      return { ok: false, error: 'Invalid JSON in email_templates setting' }
    }

    const tpl = templates.find((t) => t.code === options.templateCode)
    if (!tpl) {
      return { ok: false, error: `Email template "${options.templateCode}" not found` }
    }

    // 2. Variable substitution
    let html = tpl.html
    let subject = tpl.subject
    for (const [key, value] of Object.entries(options.variables)) {
      html = html.replaceAll(`{{${key}}}`, value)
      subject = subject.replaceAll(`{{${key}}}`, value)
    }

    // 3. Find active email provider
    const providers = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.isActive, true))
      .limit(1)

    let sendScript = ''
    let configJson: any = {}

    if (providers.length > 0 && providers[0].sendScript?.trim()) {
      sendScript = providers[0].sendScript
      configJson = providers[0].configJson ? JSON.parse(providers[0].configJson) : {}
    } else {
      // Fallback to local directory
      const providerCode = providers.length > 0 ? providers[0].code : 'resend'
      const localScriptPath = path.join(process.cwd(), 'emails', providerCode, 'send.js')
      const localConfigPath = path.join(process.cwd(), 'emails', providerCode, 'config.json')

      if (fs.existsSync(localScriptPath)) {
        sendScript = fs.readFileSync(localScriptPath, 'utf-8')
      }
      if (fs.existsSync(localConfigPath)) {
        configJson = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'))
      }

      // If provider exists in DB but has no script, use local file but DB config
      if (providers.length > 0 && providers[0].configJson) {
        try {
          configJson = JSON.parse(providers[0].configJson)
        } catch { /* keep local fallback */ }
      }
    }

    if (!sendScript.trim()) {
      return { ok: false, error: 'No email provider configured. Add a provider in Settings → Email.' }
    }

    // 4. Execute sandbox
    const result = await executeEmailScript(
      sendScript,
      { to: options.to, subject, html },
      configJson
    )

    return result
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error)
    return { ok: false, error: error.message }
  }
}
