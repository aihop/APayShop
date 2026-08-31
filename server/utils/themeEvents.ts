import { eq } from 'drizzle-orm'
import { db } from '../db/runtime'
import { settings } from '../db/schema'
import {
  themeEventManifests,
  themeEventLoaders,
  type ThemeEventRuleMeta,
} from '../../shared/generated/theme-events'

export type ThemeEventHandler = (payload: any) => Promise<{ ok: boolean, errorMessage?: string } | void>

export { ThemeEventRuleMeta }

export interface ThemeEventRule extends ThemeEventRuleMeta {
  handler: ThemeEventHandler
}

let cachedActiveTheme: string | null = null
let lastActiveThemeReadAt = 0
const THEME_CACHE_TTL = 5000

/**
 * 获取当前系统激活的主题标识（active_theme）。
 * 优先读取 settings 表配置，其次回退环境变量与默认值。
 */
export async function getActiveThemeName(): Promise<string> {
  const now = Date.now()
  if (cachedActiveTheme !== null && now - lastActiveThemeReadAt < THEME_CACHE_TTL) {
    return cachedActiveTheme
  }

  try {
    const rows = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'active_theme'))
      .limit(1)

    const fromDb = rows[0]?.value?.trim()
    const fromEnv = process.env.APAY_DEV_THEME?.trim() || process.env.DEV_THEME?.trim()
    const resolved = fromDb || fromEnv || 'qingpu'

    cachedActiveTheme = resolved
    lastActiveThemeReadAt = now
    return resolved
  } catch {
    return process.env.APAY_DEV_THEME?.trim() || process.env.DEV_THEME?.trim() || 'qingpu'
  }
}

/**
 * 通用主题事件规则元数据读取器：
 * 基于构建生成的静态清单（在 Node、Serverless、Cloudflare Worker 生产包均 100% 可用）。
 *
 * @param themeFilter
 *   - 传 string（如 'qingpu'）：仅返回该主题的规则
 *   - 传 true：仅返回当前 activeTheme 的规则
 *   - 传 false / 'all'：返回全量主题规则
 *   - 缺省（undefined）：默认仅返回当前 activeTheme 声明的规则
 */
export function getThemeEventRulesMetadata(themeFilter?: string | boolean): ThemeEventRuleMeta[] {
  if (themeFilter === false || themeFilter === 'all') {
    return Object.values(themeEventManifests).flat()
  }

  const targetTheme = typeof themeFilter === 'string'
    ? themeFilter
    : (cachedActiveTheme || process.env.APAY_DEV_THEME?.trim() || process.env.DEV_THEME?.trim() || 'qingpu')

  return themeEventManifests[targetTheme] || []
}

/**
 * 动态加载并执行主题事件处理器（生产环境通过静态 Loader 导入，零 fs 依赖）
 */
export async function executeThemeEventHandler(rule: ThemeEventRuleMeta, payload: any): Promise<{ ok: boolean, errorMessage?: string } | void> {
  if (typeof rule.handler === 'function') {
    return await rule.handler(payload)
  }

  const loader = themeEventLoaders[rule.theme]
  if (!loader) {
    console.warn(`[ThemeEvents] No event loader registered for theme "${rule.theme}"`)
    return { ok: true }
  }

  try {
    const mod = await loader()
    const getter = mod.getThemeEventRules || mod.default
    if (typeof getter === 'function') {
      const rules = await getter()
      const matched = Array.isArray(rules) ? rules.find((r: any) => r.key === rule.key) : null
      if (matched && typeof matched.handler === 'function') {
        return await matched.handler(payload)
      }
    }
    if (typeof mod.handleThemeEvent === 'function') {
      return await mod.handleThemeEvent(rule.event, payload)
    }
  } catch (err: any) {
    console.error(`[ThemeEvents] Error executing handler for ${rule.key}:`, err)
    return { ok: false, errorMessage: err?.message || String(err) }
  }
}

/**
 * 通用主题事件规则加载器：
 * 默认仅加载当前激活主题（activeTheme）的事件规则，避免未激活主题干扰当前环境。
 */
export async function loadActiveThemeEventRules(themeFilter?: string | boolean): Promise<ThemeEventRule[]> {
  let targetTheme: string | boolean | undefined = themeFilter
  if (targetTheme === undefined || targetTheme === true) {
    targetTheme = await getActiveThemeName()
  }

  const metaList = getThemeEventRulesMetadata(targetTheme)
  return metaList.map(meta => ({
    ...meta,
    handler: (payload: any) => executeThemeEventHandler(meta, payload),
  }))
}

/** 清理主题规则缓存（用于后台切换主题或测试） */
export function clearThemeEventRulesCache() {
  cachedActiveTheme = null
  lastActiveThemeReadAt = 0
}
