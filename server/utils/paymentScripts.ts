import fs from 'fs'
import path from 'path'

/**
 * 网关脚本与配置的统一解析:数据库字段优先,为空则回落到 payments/<code>/ 下的
 * 文件。initiate / webhook 各自抄过一份,查单补偿是第三处,所以收敛到这里。
 *
 * 注意 DB 优先这个顺序本身是把双刃剑:后台文本框里存了旧副本时,仓库里维护的
 * 文件是不生效的(排查问题时先确认到底跑的是哪一份)。
 */

const scriptFileName = {
  create: 'create.js',
  callback: 'callback.js',
  query: 'query.js',
} as const

export type PaymentScriptKind = keyof typeof scriptFileName

const readFirstExisting = (candidates: string[]): string | null => {
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8')
    } catch {
      // 读失败按不存在处理,交给调用方报"脚本缺失"
    }
  }
  return null
}

const localCandidates = (code: string, fileName: string) => {
  const root = path.join(process.cwd(), 'payments')
  return [
    path.join(root, code, fileName),
    path.join(root, String(code).toLowerCase(), fileName),
  ]
}

/**
 * @param kind   create / callback / query
 * @param method payment_methods 行(query 目前没有对应字段,只从文件读)
 */
export const resolvePaymentScript = (
  kind: PaymentScriptKind,
  method: { code: string } & Record<string, any>,
): { script: string; origin: 'db' | 'file' | 'none' } => {
  // query 走纯文件:它是对账基础设施,不像 create/callback 那样需要每个商户
  // 在后台按自己的网关改。少一个可被旧副本覆盖的地方。
  if (kind !== 'query') {
    const fromDb = String(method[kind] || '')
    if (fromDb.trim()) return { script: fromDb, origin: 'db' }
  }
  const fromFile = readFirstExisting(localCandidates(method.code, scriptFileName[kind]))
  if (fromFile && fromFile.trim()) return { script: fromFile, origin: 'file' }
  return { script: '', origin: 'none' }
}

export const resolvePaymentConfig = (
  method: { code: string; configJson?: string | null } & Record<string, any>,
): Record<string, any> => {
  let configJson: Record<string, any> = {}
  try {
    if (method.configJson) configJson = JSON.parse(method.configJson)
  } catch {
    // 配置是坏 JSON 时按空处理,后续由脚本自己报缺配置
  }
  if (Object.keys(configJson).length) return configJson

  const raw = readFirstExisting(localCandidates(method.code, 'config.json'))
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}
