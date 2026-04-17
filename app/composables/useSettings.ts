export const useSettings = () => {
  // 1. 定义全局状态 (Nuxt 会确保在所有组件间共享此状态)
  const settings = useState<Record<string, string> | null>('app-settings', () => null)
  const isLoading = useState('settings-loading', () => false)

  // 2. 获取配置的逻辑
  const fetchSettings = async (force = false) => {
    // 如果已经加载过且不强制刷新，直接返回
    if (settings.value && !force) return true
    
    isLoading.value = true
    try {
      // 利用 Nuxt 的 $fetch，它在 SSR 环境下表现优异
      const data = await $fetch<any[]>('/api/settings')
      
      if (Array.isArray(data)) {
        // 转换为键值对对象
        settings.value = data.reduce((acc, item) => {
          acc[item.key] = item.value
          return acc
        }, {} as Record<string, string>)
      }
      return true
    } catch (e) {
      console.error('Failed to load settings:', e)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 3. 辅助计算属性
  const getSetting = (key: string, defaultValue = '') => {
    return settings.value?.[key] ?? defaultValue
  }

  return {
    settings,
    isLoading,
    fetchSettings,
    getSetting
  }
}