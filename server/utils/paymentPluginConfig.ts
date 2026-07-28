import fs from 'fs'
import path from 'path'

const DEFAULT_PAYMENT_CURRENCIES: Record<string, string> = {
  alipay: 'CNY',
  qingpu: 'CNY',
  qixiangpay: 'CNY',
  wechat: 'CNY',
}

function readLocalPaymentConfig(methodCode: string): Record<string, any> {
  const candidates = [
    path.join(process.cwd(), 'payments', methodCode, 'config.json'),
    path.join(process.cwd(), 'payments', methodCode.toLowerCase(), 'config.json'),
  ]
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
      }
    } catch {}
  }
  return {}
}

export function resolvePaymentPluginConfig(
  methodCode: unknown,
  configJson: unknown,
): Record<string, any> {
  const localConfig = readLocalPaymentConfig(String(methodCode || ''))
  let storedConfig: Record<string, any> = {}
  try {
    const parsed = typeof configJson === 'string' ? JSON.parse(configJson) : configJson
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) storedConfig = parsed
  } catch {}
  const methodKey = String(methodCode || '').trim().toLowerCase()
  const config = { ...localConfig, ...storedConfig }
  const declaredCurrency = config.currency ?? config.sourceCurrency ?? config.priceCurrency
  if (!String(declaredCurrency || '').trim() && DEFAULT_PAYMENT_CURRENCIES[methodKey]) {
    config.currency = DEFAULT_PAYMENT_CURRENCIES[methodKey]
  }
  return config
}
