export type SettingValues = Record<string, string | null | undefined>

const normalizeLocale = (locale: unknown) => String(locale || '')
  .trim()
  .replaceAll('_', '-')

const toSettingLocale = (locale: string) => locale.replaceAll('-', '_')

export const getLocalizedSettingKeys = (baseKey: string, locale: unknown): string[] => {
  const normalizedLocale = normalizeLocale(locale)
  const localeCandidates = normalizedLocale
    ? [normalizedLocale, normalizedLocale.split('-')[0] || '']
    : []

  return [...new Set([
    ...localeCandidates
      .filter(localeCode => localeCode && localeCode !== 'en')
      .map(localeCode => `${toSettingLocale(localeCode)}_${baseKey}`),
    baseKey,
  ])]
}

export const resolveLocalizedSetting = (
  settings: SettingValues | null | undefined,
  baseKey: string,
  locale: unknown,
  defaultValue = '',
): string => {
  for (const key of getLocalizedSettingKeys(baseKey, locale)) {
    const value = String(settings?.[key] ?? '').trim()
    if (value) return value
  }

  return defaultValue
}
