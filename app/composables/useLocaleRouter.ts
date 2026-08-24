export const useLocaleRouter = () => {
  const resolveLocalePath = useLocalePath()

  const localePush = (path: string) => {
    return navigateTo(localePath(path))
  }

  const localePath = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return resolveLocalePath(normalizedPath)
  }

  return {
    localePush,
    localePath
  }
}
