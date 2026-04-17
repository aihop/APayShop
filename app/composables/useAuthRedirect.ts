import { useRoute, useRouter } from 'vue-router'
import { useLocaleRouter } from './useLocaleRouter'

export const useAuthRedirect = () => {
  const route = useRoute()
  const router = useRouter()
  const { localePath } = useLocaleRouter()

  /**
   * 跳转到登录页面，并带上当前页面路径作为重定向参数
   */
  const navigateToLogin = () => {
    // 过滤掉本身就是 /auth/login 的情况，防止无限循环重定向
    if (route.path.includes('/auth/login')) {
      return
    }
    
    router.push({
      path: localePath('/auth/login'),
      query: { redirect: route.fullPath }
    })
  }

  return {
    navigateToLogin
  }
}
