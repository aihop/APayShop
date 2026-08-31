import { extensionDatabaseRequirements } from '../extensions/extensionDatabase.generated'

type ExtensionCapability = {
  key: string
  label: string
  labelZh: string
  editable?: boolean
}

type ExtensionPage = {
  key: string
  title: string
  titleZh?: string
  description?: string
  descriptionZh?: string
  component: string
  capability?: string
  icon?: string
  order?: number
}

type ExtensionManifest = {
  schemaVersion: number
  id: string
  name: string
  description: string
  version: string
  defaultEnabled?: boolean
  capabilities?: ExtensionCapability[]
  adminPages?: ExtensionPage[]
  userPages?: ExtensionPage[]
  database?: {
    migrations?: Array<{ id: string }>
  }
}

const manifestModules = import.meta.glob('../extensions/*/extension.json', {
  eager: true,
  import: 'default',
}) as Record<string, ExtensionManifest>

const adminPageModules = import.meta.glob('../extensions/*/admin/pages/**/*.vue', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const userPageModules = import.meta.glob('../extensions/*/user/pages/**/*.vue', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const parseEnabledExtensions = (raw: string, manifests: ExtensionManifest[]) => {
  if (!raw) return manifests.filter(
    manifest => manifest.defaultEnabled && !manifest.database?.migrations?.length,
  ).map(manifest => manifest.id)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []
  } catch {
    return []
  }
}

const hasAppliedMigrations = (manifest: ExtensionManifest, raw: string) => {
  const required = manifest.database?.migrations?.map(migration => migration.id) || []
  if (!required.length) return true
  try {
    const applied = JSON.parse(raw) as { dialect?: 'sqlite' | 'postgresql' | 'mysql', checksums?: Record<string, string> }
    if (!applied.dialect || !applied.checksums) return false
    const expected = extensionDatabaseRequirements[manifest.id]?.[applied.dialect] || {}
    return required.every(id => applied.checksums?.[id] === expected[id])
  } catch {
    return false
  }
}

export const pluginPermissionCode = (extension: string, capability: string) =>
  `plugin:${extension}:${capability}`

export const useExtensions = () => {
  const { getSetting } = useSettings()
  const { locale } = useNuxtApp().$i18n

  const installedExtensions = computed(() => Object.values(manifestModules)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)))

  const enabledExtensionIds = computed(() => new Set(
    parseEnabledExtensions(getSetting('enabled_extensions'), installedExtensions.value),
  ))

  const enabledExtensions = computed(() => installedExtensions.value.filter(
    manifest => enabledExtensionIds.value.has(manifest.id)
      && hasAppliedMigrations(manifest, getSetting(`extension_migrations:${manifest.id}`)),
  ))

  const localize = (english: string, chinese?: string) =>
    locale.value.startsWith('zh') ? (chinese || english) : english

  const adminPages = computed(() => enabledExtensions.value.flatMap(manifest =>
    (manifest.adminPages || []).flatMap((page) => {
      const componentPath = `../extensions/${manifest.id}/admin/pages/${page.component}`
      if (!adminPageModules[componentPath] || !page.capability) return []
      return [{
        ...page,
        title: localize(page.title, page.titleZh),
        description: localize(page.description || '', page.descriptionZh),
        route: `/admin/plugins/${manifest.id}/${page.key}`,
        componentPath,
        component: adminPageModules[componentPath],
        icon: page.icon || 'ph:puzzle-piece',
        order: page.order ?? 999,
        extensionKey: `plugin-${manifest.id}`,
        sectionTitle: manifest.name,
        permissionCode: pluginPermissionCode(manifest.id, page.capability),
      }]
    }),
  ))

  const userPages = computed(() => enabledExtensions.value.flatMap(manifest =>
    (manifest.userPages || []).flatMap((page) => {
      const componentPath = `../extensions/${manifest.id}/user/pages/${page.component}`
      if (!userPageModules[componentPath]) return []
      return [{
        ...page,
        title: localize(page.title, page.titleZh),
        route: `/user/plugins/${manifest.id}/${page.key}`,
        componentPath,
        component: userPageModules[componentPath],
      }]
    }),
  ))

  const permissionDefs = computed(() => enabledExtensions.value.flatMap(manifest =>
    (manifest.capabilities || []).map(capability => ({
      code: pluginPermissionCode(manifest.id, capability.key),
      label: capability.label,
      labelZh: capability.labelZh,
      apiPrefixes: [],
      routes: adminPages.value
        .filter(page => page.extensionKey === `plugin-${manifest.id}` && page.capability === capability.key)
        .map(page => page.route),
      editable: capability.editable ?? true,
    })),
  ))

  const findAdminPage = (path: string) => adminPages.value.find(page => page.route === path) || null
  const findUserPage = (path: string) => userPages.value.find(page => page.route === path) || null

  return {
    installedExtensions,
    enabledExtensionIds,
    enabledExtensions,
    adminPages,
    userPages,
    permissionDefs,
    findAdminPage,
    findUserPage,
  }
}
