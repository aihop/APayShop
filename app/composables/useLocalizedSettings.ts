import { resolveLocalizedSetting } from '~~/shared/utils/localizedSettings'

export const useLocalizedSettings = () => {
  const { settings } = useSettings()
  const { locale } = useI18n()

  const getLocalizedSetting = (key: string, defaultValue = '') => {
    return resolveLocalizedSetting(settings.value, key, locale.value, defaultValue)
  }

  return {
    getLocalizedSetting,
  }
}
