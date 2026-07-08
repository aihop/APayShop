import * as themeBuild from '~/generated/theme-build'

type AdminExtensionManifestPage = {
  key: string
  title: string
  description?: string
  route: string
  component: string
  icon?: string
  order?: number
}

type AdminExtensionManifest = {
  name?: string
  pages?: AdminExtensionManifestPage[]
}

const normalizeRoute = (route: string, key: string) => {
  if (!route) {
    return `/admin/extensions/${key}`
  }

  if (route.startsWith('/admin/')) {
    return route
  }

  return `/admin/extensions/${route.replace(/^\/+/, '')}`
}

const normalizeComponent = (component: string, key: string) => {
  const target = component || key
  return target.endsWith('.vue') ? target : `${target}.vue`
}

const formatThemeName = (theme: string) =>
  theme
    .split(/[-_]/g)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

export const useAdminExtensions = () => {
  const { getSetting } = useSettings()

  const activeTheme = computed(() => {
    const theme = getSetting('active_theme') || ''
    return themeBuild.publishedOptionalThemeSet.has(theme) ? theme : ''
  })

  const manifest = computed<AdminExtensionManifest>(() => {
    if (!activeTheme.value) return {}
    return (themeBuild.themeAdminManifestModules[`../themes/${activeTheme.value}/theme.admin.json`] || {}) as AdminExtensionManifest
  })

  const themeSectionTitle = computed(() => {
    return manifest.value.name || `${formatThemeName(activeTheme.value)} Admin`
  })

  const extensionPages = computed(() => {
    const pages = manifest.value.pages || []

    return pages
      .map((page) => {
        const route = normalizeRoute(page.route, page.key)
        const component = normalizeComponent(page.component, page.key)
        const componentPath = `../themes/${activeTheme.value}/admin/pages/${component}`

        if (!themeBuild.themeAdminPageModules[componentPath]) {
          return null
        }

        return {
          ...page,
          route,
          component,
          componentPath,
          icon: page.icon || 'ph:puzzle-piece',
          order: page.order ?? 999,
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a!.order as number) - (b!.order as number)) as Array<
        AdminExtensionManifestPage & {
          componentPath: string
          icon: string
          order: number
        }
      >
  })

  const findExtensionPage = (path: string) =>
    extensionPages.value.find(page => page.route === path) || null

  const resolveExtensionComponent = (path: string) => {
    const page = findExtensionPage(path)
    if (!page) {
      return null
    }

    return themeBuild.themeAdminPageModules[page.componentPath] || null
  }

  return {
    activeTheme,
    manifest,
    themeSectionTitle,
    extensionPages,
    findExtensionPage,
    resolveExtensionComponent,
  }
}
