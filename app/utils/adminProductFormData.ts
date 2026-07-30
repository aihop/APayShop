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
