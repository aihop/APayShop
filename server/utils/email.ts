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

    // 危险全局遮蔽(与支付沙盒 sandbox.ts 同一套说明):AsyncFunction 本质是 Function
    // 构造器,脚本与宿主同环境。用同名参数把 process/globalThis/require 等挡在词法
    // 作用域外,防止脚本"顺手"读环境变量/文件系统。注意这不是完整隔离(原型链仍可
    // 摸到构造器),真隔离需 isolated-vm/独立进程——邮件脚本的信任边界仍是后台管理员。
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
 * Templates are stored in settings.email_templates as a JSON array,
 * or can be passed inline via options.templates.
 */
export async function sendEmail(options: {
  to: string
  templateCode: string
  variables: Record<string, string>
  locale?: string
  templates?: string // optional inline JSON array of EmailTemplate, skips DB lookup
}): Promise<EmailSendResult> {
  try {
    // 1. Load templates from settings or inline
    let templates: EmailTemplate[]

    if (options.templates) {
      try {
        templates = JSON.parse(options.templates)
      } catch {
        return { ok: false, error: 'Invalid JSON in inline templates' }
      }
      if (!templates.length) {
        return { ok: false, error: 'No email templates available. Create a template first.' }
      }
    } else {
      const templateSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'email_templates'))
        .limit(1)

      if (!templateSetting.length || !templateSetting[0].value) {
        return { ok: false, error: 'No email templates configured (email_templates setting is empty)' }
      }

      try {
        templates = JSON.parse(templateSetting[0].value)
      } catch {
        return { ok: false, error: 'Invalid JSON in email_templates setting' }
      }

      if (!templates.length) {
        return { ok: false, error: 'No email templates available. Create a template first.' }
      }
    }

    // Locale-aware template lookup:
    // 1) requested locale
    // 2) Chinese default pack
    // 3) generic code
    const normalizedLocale = options.locale?.trim().toLowerCase() || ''
    const localeCode = normalizedLocale ? `${options.templateCode}-${normalizedLocale}` : null
    const zhLocaleCode = `${options.templateCode}-zh`
    let tpl: EmailTemplate | undefined

    if (localeCode) {
      tpl = templates.find((t) => t.code === localeCode)
    }
    if (!tpl && localeCode !== zhLocaleCode) {
      tpl = templates.find((t) => t.code === zhLocaleCode)
    }
    if (!tpl) {
      tpl = templates.find((t) => t.code === options.templateCode)
    }
    if (!tpl) {
      // Fallback to default template if configured
      const defaultSetting = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'email_default_template'))
        .limit(1)

      const defaultCode = defaultSetting.length > 0 ? defaultSetting[0].value : null
      if (defaultCode && defaultCode !== '__none__') {
        tpl = templates.find((t) => t.code === defaultCode)
      }

      if (!tpl) {
        return { ok: false, error: `Email template "${options.templateCode}"${localeCode ? ` (or "${localeCode}")` : ''} not found` }
      }
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
      let providerCode = providers.length > 0 ? providers[0].code : 'resend'

      // If no provider in DB yet, try reading provider code from settings
      if (providers.length === 0) {
        const codeSetting = await db
          .select()
          .from(settings)
          .where(eq(settings.key, 'email_provider_code'))
          .limit(1)
        if (codeSetting.length > 0 && codeSetting[0].value) {
          providerCode = codeSetting[0].value
        }
      }

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

      // Load user's saved configJson from settings if no provider DB record exists
      if (providers.length === 0) {
        const configSetting = await db
          .select()
          .from(settings)
          .where(eq(settings.key, 'email_provider_config_json'))
          .limit(1)
        if (configSetting.length > 0 && configSetting[0].value) {
          try {
            configJson = JSON.parse(configSetting[0].value)
          } catch { /* keep local fallback config */ }
        }
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
