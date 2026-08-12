type FormRecord = Record<string, any>

const createUiId = (): string =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9)

export const parseServiceSchemaFields = (value: string): FormRecord[] => {
  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
  return parsed.map((field: FormRecord) => ({
    id: createUiId(),
    name: field.name || '',
    label: field.label || '',
    type: field.type || 'text',
    required: field.required !== false,
  }))
}

export const parseProductFeatures = (value: unknown): FormRecord[] => {
  const features = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(features) ? features.map((feature: FormRecord) => ({
    id: createUiId(),
    name: feature.name || '',
    icon: feature.icon || 'ph:check',
    included: feature.included !== false,
  })) : []
}

export const stripUiIds = (items: FormRecord[]): FormRecord[] =>
  items.map(({ id, ...rest }) => rest)

export const cleanServiceSchemaFields = (fields: FormRecord[]): FormRecord[] =>
  fields.map(field => ({
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
  }))

export const cleanProductFeatures = (features: FormRecord[]): FormRecord[] =>
  features
    .map(feature => ({
      name: String(feature.name || '').trim(),
      icon: feature.icon,
      included: feature.included,
    }))
    .filter(feature => feature.name)

// ==========================================
// 商品元数据表单预设
// ==========================================

/**
 * meta_data 的 schema 注释写的是「EAV 自定义属性」，但实际每个键都在
 * ProductFormModal 里写死了一个控件——主题需要的业务字段就无处安放：要么往核心
 * 表单加控件、让核心去认识只有某个主题懂的概念，要么运营根本没地方填。
 *
 * 预设让运营按商品类型声明字段（名称/标签/类型/必填），表单据此渲染并直接写入
 * meta_data。核心因此**不需要认识任何具体业务键名**——它们全是数据。
 *
 * 只做加法：现有写死控件一个都不动，预设字段渲染在它们之下。
 */

/** settings 表里存预设的键 */
export const PRODUCT_META_PRESETS_KEY = 'product_meta_presets'

/**
 * 已被写死控件接管的 meta 键。预设渲染时排除它们，否则同一个键会出现两个输入框，
 * 两边互相覆盖。新增写死控件时必须同步登记到这里。
 */
export const RESERVED_META_KEYS = new Set([
  'allowed_scopes',
  'api_endpoint',
  'balance_type',
  'delivery_message',
  'display_unit',
  'download_instruction',
  'download_url',
  'form_schema',
  'form_schema_labels',
  'interval',
  'interval_count',
  'is_pricing_plan',
  'name_zh',
  'perUserLimit',
  'plan_badge',
  'plan_badge_zh',
  'plan_color',
  'plan_features',
  'plan_ids',
  'quota',
  'recharge_amount',
  'sync_secret',
  'sync_webhook_url',
  'translations',
  'valid_days',
])

export const PRESET_FIELD_TYPES = ['text', 'number', 'boolean', 'textarea'] as const
export type PresetFieldType = typeof PRESET_FIELD_TYPES[number]

const normalizePresetType = (value: unknown): PresetFieldType =>
  (PRESET_FIELD_TYPES as readonly string[]).includes(String(value))
    ? value as PresetFieldType
    : 'text'

/** 字段名限制为 JSON 键里安全的一小撮字符，避免运营敲出带点/引号的键把 meta 结构搞乱 */
const PRESET_FIELD_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

export const isValidPresetFieldName = (value: string) =>
  PRESET_FIELD_NAME_PATTERN.test(value) && !RESERVED_META_KEYS.has(value)

/**
 * 解析单个类型下的字段数组(带 UI id,供编辑器使用)。
 *
 * 坏数据一律退化为空数组,绝不抛出:这个函数被商品表单的 computed 调用,
 * 一旦抛出就是整个管理端商品弹窗打不开——而预设只是锦上添花的自定义字段,
 * 不该有能力让主表单开不了。settings 里存进一条 {"subscription":"[broken"}
 * 就足以触发。
 */
export const parseMetaPresetFields = (value: unknown): FormRecord[] => {
  let list: unknown = value
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { return [] }
  }
  if (!Array.isArray(list)) return []
  return list.map((field: FormRecord) => ({
    id: createUiId(),
    name: String(field?.name || ''),
    label: String(field?.label || ''),
    type: normalizePresetType(field?.type),
    required: field?.required === true,
    // 可选默认值:只在**新建**商品时预填,不回填既有商品。
    // 回填会让「这个键没配过」和「配过且等于默认值」变得无法区分,而下游
    // (如按额度判断)往往靠「键不存在 = 不限制」来保证不误伤存量商品。
    default: field?.default ?? null,
  }))
}

/**
 * 解析整份预设:{ 商品类型: 字段数组 }。
 * 任何形状异常都退化成空预设——预设读不出来只应导致「没有额外字段」,
 * 绝不能让商品表单本身开不出来。
 */
export const parseMetaPresets = (value: unknown): Record<string, FormRecord[]> => {
  let raw: any = value
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return {} }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const result: Record<string, FormRecord[]> = {}
  for (const [productType, fields] of Object.entries(raw)) {
    result[productType] = parseMetaPresetFields(fields)
  }
  return result
}

/** 落库形状:去掉 UI id,丢弃无效/保留键,同名只留第一条 */
export const cleanMetaPresetFields = (fields: FormRecord[]): FormRecord[] => {
  const seen = new Set<string>()
  return fields
    .map(field => ({
      name: String(field?.name || '').trim(),
      label: String(field?.label || '').trim(),
      type: normalizePresetType(field?.type),
      required: field?.required === true,
      default: field?.default === '' || field?.default === undefined ? null : field.default,
    }))
    .filter(field => {
      if (!isValidPresetFieldName(field.name)) return false
      if (seen.has(field.name)) return false
      seen.add(field.name)
      return true
    })
}

export const cleanMetaPresets = (presets: Record<string, FormRecord[]>): Record<string, FormRecord[]> => {
  const result: Record<string, FormRecord[]> = {}
  for (const [productType, fields] of Object.entries(presets)) {
    const cleaned = cleanMetaPresetFields(fields || [])
    if (cleaned.length) result[productType] = cleaned
  }
  return result
}

/** 表单渲染用:取某个商品类型下、排除保留键之后的字段 */
export const presetFieldsForType = (
  presets: Record<string, FormRecord[]>,
  productType: string,
): FormRecord[] => (presets[productType] || []).filter(field => isValidPresetFieldName(field.name))
