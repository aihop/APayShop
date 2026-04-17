import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

export const useLocaleRouter = () => {
  const router = useRouter()
  const route = useRoute()
  const i18n = useI18n()

  const localePush = (path: string) => {
    return router.push(localePath(path))
  }

  const localePath = (path: string) => {
    // 确保 path 以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    
    // 如果当前不是默认语言(en)，且目标路径不包含当前语言前缀，则添加前缀
    if (i18n.locale.value !== 'en' && !normalizedPath.startsWith(`/${i18n.locale.value}`)) {
      // 避免出现 /zh/ 这样的路径，如果是根路径直接跳 /zh
      if (normalizedPath === '/') {
        return `/${i18n.locale.value}`
      }
      return `/${i18n.locale.value}${normalizedPath}`
    }
    
    return normalizedPath
  }

  return {
    localePush,
    localePath
  }
}