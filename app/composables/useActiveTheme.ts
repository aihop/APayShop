import { computed } from 'vue'
import * as themeBuild from '~/generated/theme-build'

export const useActiveTheme = () => {
  const { getSetting } = useSettings()
  const config = useRuntimeConfig()

  return computed(() => {
    const devTheme = String(config.public.devTheme || '')
    if (devTheme && themeBuild.publishedOptionalThemeSet.has(devTheme)) return devTheme
    const configuredTheme = getSetting('active_theme') || ''
    return themeBuild.publishedOptionalThemeSet.has(configuredTheme) ? configuredTheme : ''
  })
}
