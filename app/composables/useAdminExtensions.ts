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

const manifestModules = import.meta.glob('../themes/**/theme.admin.json', {
  eager: true,
  import: 'default',
}) as Record<string, AdminExtensionManifest>

const extensionModules = import.meta.glob('../themes/**/admin/pages/**/*.vue', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

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

  const activeTheme = computed(() => getSetting('active_theme') || 'default')

  const manifest = computed<AdminExtensionManifest>(() => {
    return manifestModules[`../themes/${activeTheme.value}/theme.admin.json`] || {}
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

        if (!extensionModules[componentPath]) {
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

    return extensionModules[page.componentPath] || null
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
