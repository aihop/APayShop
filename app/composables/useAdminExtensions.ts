import * as themeBuild from '~/generated/theme-build'

type AdminExtensionManifestPage = {
  key: string
  title: string
  description?: string
  route: string
  component?: string
  icon?: string
  order?: number
  permissionCode?: string
}

type AdminExtensionManifest = {
  name?: string
  pages?: AdminExtensionManifestPage[]
}

type AdminExtensionGroup = AdminExtensionManifest & {
  key: string
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

const normalizeComponent = (component: string | undefined, key: string) => {
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
  const appConfig = useAppConfig()

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

  const moduleExtensionSections = computed<AdminExtensionGroup[]>(() => {
    const configured = (appConfig as Record<string, unknown>).adminExtensions
    if (!Array.isArray(configured)) return []
    return configured.filter((group): group is AdminExtensionGroup =>
      Boolean(group && typeof group === 'object' && typeof group.key === 'string' && Array.isArray(group.pages))
    )
  })

  const extensionPages = computed(() => {
    const pages = manifest.value.pages || []

    const themePages = pages
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

    const modulePages = moduleExtensionSections.value.flatMap(section =>
      (section.pages || []).map(page => ({
        ...page,
        route: normalizeRoute(page.route, page.key),
        icon: page.icon || 'ph:puzzle-piece',
        order: page.order ?? 999,
        extensionKey: section.key,
        sectionTitle: section.name || formatThemeName(section.key),
      }))
    )

    return [...themePages.map(page => ({
      ...page,
      extensionKey: activeTheme.value,
      sectionTitle: themeSectionTitle.value,
    })), ...modulePages]
  })

  const extensionSections = computed(() => {
    const sections = new Map<string, { key: string; title: string; pages: typeof extensionPages.value }>()
    extensionPages.value.forEach((page) => {
      const key = page.extensionKey
      const section = sections.get(key) || { key, title: page.sectionTitle, pages: [] }
      section.pages.push(page)
      sections.set(key, section)
    })
    return [...sections.values()]
  })

  const findExtensionPage = (path: string) =>
    extensionPages.value.find(page => page.route === path) || null

  const resolveExtensionComponent = (path: string) => {
    const page = findExtensionPage(path)
    if (!page || !('componentPath' in page)) {
      return null
    }

    return themeBuild.themeAdminPageModules[String(page.componentPath)] || null
  }

  // One permission per extension page, namespaced to the active theme so a
  // stored code stays inert (matches nothing) if the theme is later switched.
  const extensionPermissionDefs = computed(() =>
    extensionPages.value.map(page => ({
      code: page.permissionCode || themeExtensionPermissionCode(page.extensionKey, page.key),
      label: page.title,
      labelZh: page.title,
      apiPrefixes: [],
      routes: [page.route],
      editable: undefined,
    }))
  )

  return {
    activeTheme,
    manifest,
    themeSectionTitle,
    extensionPages,
    extensionSections,
    extensionPermissionDefs,
    findExtensionPage,
    resolveExtensionComponent,
  }
}
