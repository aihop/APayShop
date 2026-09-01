<template>
  <USlideover
    v-model:open="innerOpen"
    side="left"
  >
    <template #content>
      <div class="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-[#09090b] dark:text-gray-100">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center gap-2.5">
            <div
              v-if="getSetting('site_logo')"
              class="w-8 h-8 flex items-center justify-center"
            >
              <SiteLogo
                :logo-data="getSetting('site_logo')"
                :alt="getLocalizedSetting('site_name')"
              />
            </div>
            <span class="relative inline-flex items-center font-bold tracking-tight text-lg sm:text-xl">
              <span class="absolute -inset-x-1.5 -inset-y-0.5 rounded-lg bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-cyan-500/15 blur-sm dark:opacity-40 dark:animate-pulse pointer-events-none"></span>
              <span class="relative bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-200 dark:to-indigo-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                {{ getLocalizedSetting('site_name') }}
              </span>
            </span>
          </div>
          <div class="flex items-center gap-1">
            <ClientOnly>
              <UButton
                color="neutral"
                variant="ghost"
                :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
                :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                @click="toggleColorMode"
              />
            </ClientOnly>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x-bold"
              @click="closeMenu"
            />
          </div>
        </div>

        <nav class="flex flex-col gap-4">
          <div class="space-y-1">
            <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(storeSection) }}</h3>
            <template v-for="item in storeSectionItems" :key="item.type === 'link' ? item.to : item.key">
              <!-- 普通单链接 -->
              <NuxtLink
                v-if="item.type === 'link'"
                :to="item.to"
                :class="adminMobileNavItemClass"
                @click="closeMenu"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    :name="item.icon"
                    class="w-5 h-5"
                  />
                  {{ item.label }}
                </div>
              </NuxtLink>

              <!-- 折叠分组 -->
              <div v-else class="space-y-1">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                  @click="toggleGroup(item.key)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon :name="item.icon" class="w-5 h-5 text-purple-500" />
                    <span>{{ item.title }}</span>
                  </div>
                  <UIcon
                    name="ph:caret-down-bold"
                    class="w-4 h-4 transition-transform duration-200 opacity-60"
                    :class="isGroupExpanded(item.key) ? 'rotate-0' : '-rotate-90'"
                  />
                </button>

                <div
                  v-show="isGroupExpanded(item.key)"
                  class="ml-5 pl-2.5 space-y-1 border-l border-gray-200 dark:border-gray-800"
                >
                  <NuxtLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    :class="adminMobileNavItemClass"
                    @click="closeMenu"
                  >
                    <div class="flex items-center gap-2 text-xs">
                      <UIcon :name="child.icon" class="w-4 h-4 text-gray-400" />
                      {{ child.label }}
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </template>
          </div>

          <div
            v-for="section in allowedExtensionSections"
            :key="section.key"
            class="space-y-1 mt-4"
          >
            <h3 :class="adminSectionTitleClass">{{ section.title }}</h3>

            <template v-for="item in section.items" :key="item.type === 'link' ? item.to : item.key">
              <!-- 普通单链接 -->
              <NuxtLink
                v-if="item.type === 'link'"
                :to="item.to"
                :class="adminMobileNavItemClass"
                @click="closeMenu"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="item.icon"
                    class="w-5 h-5"
                  />
                  {{ item.label }}
                </div>
              </NuxtLink>

              <!-- 折叠分组 -->
              <div v-else class="space-y-1">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                  @click="toggleGroup(item.key)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon :name="item.icon" class="w-5 h-5 text-purple-500" />
                    <span>{{ item.title }}</span>
                  </div>
                  <UIcon
                    name="ph:caret-down-bold"
                    class="w-4 h-4 transition-transform duration-200 opacity-60"
                    :class="isGroupExpanded(item.key) ? 'rotate-0' : '-rotate-90'"
                  />
                </button>

                <div
                  v-show="isGroupExpanded(item.key)"
                  class="ml-5 pl-2.5 space-y-1 border-l border-gray-200 dark:border-gray-800"
                >
                  <NuxtLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    :class="adminMobileNavItemClass"
                    @click="closeMenu"
                  >
                    <div class="flex items-center gap-2 text-xs">
                      <UIcon :name="child.icon" class="w-4 h-4 text-gray-400" />
                      {{ child.label }}
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </template>
          </div>

          <div class="space-y-1 mt-4">
            <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(configSection) }}</h3>
            <NuxtLink
              v-for="item in configSection.items"
              :key="item.to"
              :to="item.to"
              :class="adminMobileNavItemClass"
              @click="closeMenu"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="item.icon"
                  class="w-5 h-5"
                />
                {{ resolveLabel(item) }}
              </div>
            </NuxtLink>
          </div>
        </nav>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
// 后台移动端导航抽屉,由 layouts/admin.vue 独占挂载。
// 2026-07 从 AppMobileMenu 的 isAdminRoute 分支拆出,只在 admin 布局内
// 渲染,因此不再需要路由判定,产品类型直接在挂载时加载。
import { onMounted } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

interface NavSingleEntry {
  type: 'link'
  to: string
  icon: string
  label: string
  order?: number
}

interface NavGroupEntry {
  type: 'group'
  key: string
  title: string
  icon: string
  order: number
  children: NavSingleEntry[]
}

type NavItem = NavSingleEntry | NavGroupEntry

const { getSetting } = useSettings()
const { getLocalizedSetting } = useLocalizedSettings()
const { extensionSections } = useAdminExtensions()
const { storeSection, configSection, resolveLabel, resolveSectionTitle, loadProductTypes, hasPermissionFor } = useAdminNav()
const { adminSectionTitleClass, adminMobileNavItemClass } = useAdminNavStyle()
const colorMode = useColorMode()

// 分组展开/折叠状态映射，默认所有分组均展开（未显式折叠即为展开）
const expandedGroups = ref<Record<string, boolean>>({})

const isGroupExpanded = (groupKey: string) => {
  return expandedGroups.value[groupKey] !== false
}

const toggleGroup = (groupKey: string) => {
  expandedGroups.value[groupKey] = !isGroupExpanded(groupKey)
}

const storeSectionItems = computed(() => {
  return storeSection.items
    .filter(item => !item.conditional || item.conditional())
    .map((item) => {
      if (item.children && item.children.length) {
        const validChildren = item.children
          .filter(child => !child.conditional || child.conditional())
          .map(child => ({
            type: 'link' as const,
            to: child.to,
            icon: child.icon,
            label: resolveLabel(child),
          }))

        if (validChildren.length > 1) {
          return {
            type: 'group' as const,
            key: `store-${item.to}`,
            title: resolveLabel(item),
            icon: item.icon,
            order: 0,
            children: validChildren,
          }
        }
      }

      return {
        type: 'link' as const,
        to: item.to,
        icon: item.icon,
        label: resolveLabel(item),
      }
    })
})

const allowedExtensionSections = computed(() => extensionSections.value
  .map((section) => {
    const allowedPages = section.pages.filter(page =>
      hasPermissionFor(page.permissionCode || themeExtensionPermissionCode(page.extensionKey, page.key))
    )
    if (!allowedPages.length) return null

    const groupsMap = new Map<string, { title: string; icon: string; order: number; children: NavSingleEntry[] }>()
    const directItems: NavSingleEntry[] = []

    allowedPages.forEach((page) => {
      const entry: NavSingleEntry = {
        type: 'link',
        to: page.route,
        icon: page.icon,
        label: page.title,
        order: page.order ?? 99,
      }

      if (page.group) {
        const groupKey = `group-${page.group}`
        const existing = groupsMap.get(groupKey) || {
          title: page.group,
          icon: page.groupIcon || 'ph:folder-bold',
          order: page.groupOrder ?? 99,
          children: [],
        }
        existing.children.push(entry)
        groupsMap.set(groupKey, existing)
      } else {
        directItems.push(entry)
      }
    })

    const items: NavItem[] = [...directItems]
    for (const [key, group] of groupsMap.entries()) {
      items.push({
        type: 'group',
        key,
        title: group.title,
        icon: group.icon,
        order: group.order,
        children: group.children,
      })
    }

    items.sort((a, b) => {
      const orderA = a.order ?? 0
      const orderB = b.order ?? 0
      return orderA - orderB
    })

    return {
      ...section,
      items,
    }
  })
  .filter(Boolean) as Array<{ key: string; title: string; items: NavItem[] }>
)

const innerOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const isDark = computed(() => colorMode.value === 'dark')

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const closeMenu = () => {
  innerOpen.value = false
}

onMounted(async () => {
  await loadProductTypes()
})
</script>
