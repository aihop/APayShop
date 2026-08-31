/**
 * 严格邮箱格式与真实合法性验证工具
 * 遵循 RFC 5321 / RFC 5322 规范子集，并防御恶意字符、格式畸变与一次性临时垃圾邮箱
 */

// 常见一次性/临时垃圾邮箱黑名单（防止恶意批量机刷与爬虫注册）
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'grr.la',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'dispostable.com',
  'sharklasers.com',
  'trashmail.com',
  'getairmail.com',
  'mytemp.email',
  'crazymailing.com',
  'fakemailgenerator.com',
  'mohmal.com',
  'maildrop.cc',
  'inboxkitten.com',
  'burnermail.io',
])

export interface EmailValidationResult {
  valid: boolean
  errorKey?: string
  normalizedEmail?: string
}

/**
 * 清洗并标准化邮箱地址
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase()
}

/**
 * 严格验证邮箱地址的有效性
 * @param rawEmail 待验证的邮箱字符串
 * @param options 可选配置（如是否禁止临时邮箱）
 */
export function validateEmail(
  rawEmail: string | null | undefined,
  options: { allowDisposable?: boolean } = {}
): EmailValidationResult {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, errorKey: 'email_required' }
  }

  const email = normalizeEmail(rawEmail)

  // 1. 基础长度限制 (RFC 5321)
  if (email.length < 5 || email.length > 254) {
    return { valid: false, errorKey: 'email_invalid_length' }
  }

  // 2. 必须包含且仅包含一个 @ 符号
  const atIndex = email.indexOf('@')
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || atIndex === email.length - 1) {
    return { valid: false, errorKey: 'email_invalid_format' }
  }

  const localPart = email.slice(0, atIndex)
  const domainPart = email.slice(atIndex + 1)

  // 3. 用户名（Local Part）验证 (最大 64 字符)
  if (localPart.length === 0 || localPart.length > 64) {
    return { valid: false, errorKey: 'email_invalid_local_part' }
  }

  // 本地部分不能以点开头或结尾，不能有连续点
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { valid: false, errorKey: 'email_invalid_local_part' }
  }

  // 本地部分字符集规范 (允许常见字母、数字及 . _ - + 等)
  const localRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/
  if (!localRegex.test(localPart)) {
    return { valid: false, errorKey: 'email_invalid_characters' }
  }

  // 4. 域名部分（Domain Part）验证
  if (domainPart.length < 3 || domainPart.length > 253) {
    return { valid: false, errorKey: 'email_invalid_domain' }
  }

  // 域名不能以点或短横线开头/结尾，不能有连续点
  if (
    domainPart.startsWith('.')
    || domainPart.endsWith('.')
    || domainPart.startsWith('-')
    || domainPart.endsWith('-')
    || domainPart.includes('..')
  ) {
    return { valid: false, errorKey: 'email_invalid_domain' }
  }

  // 必须包含顶级域名（TLD），且不能是纯 IP
  const domainLabels = domainPart.split('.')
  if (domainLabels.length < 2) {
    return { valid: false, errorKey: 'email_invalid_tld' }
  }

  const tld = domainLabels[domainLabels.length - 1]!
  // 顶级域名至少 2 个字母，且必须全为字母 (如 .com, .cn, .org, .net, .ai, .io 等)
  if (!/^[a-zA-Z]{2,24}$/.test(tld)) {
    return { valid: false, errorKey: 'email_invalid_tld' }
  }

  // 检查域名的每一级标签 (每个 label 1-63 字符，只允许字母、数字和连字符，不以连字符开头/结尾)
  for (const label of domainLabels) {
    if (!label || label.length > 63) {
      return { valid: false, errorKey: 'email_invalid_domain_label' }
    }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return { valid: false, errorKey: 'email_invalid_domain_label' }
    }
  }

  // 5. 过滤一次性/临时垃圾邮箱
  if (!options.allowDisposable && DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return { valid: false, errorKey: 'email_disposable_rejected' }
  }

  return {
    valid: true,
    normalizedEmail: email,
  }
}
