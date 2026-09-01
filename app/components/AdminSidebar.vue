<template>
  <aside
    class="fixed bottom-0 left-0 top-16 z-30 hidden flex-col border-r border-gray-200/80 bg-white transition-[width] duration-200 dark:border-white/5 dark:bg-[#0c0c0e] md:flex"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <div class="admin-sidebar-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-6">
      <div class="space-y-6">
        <div
          v-for="section in sections"
          :key="section.key"
        >
          <h3
            v-if="!collapsed"
            :class="adminSectionTitleClass"
          >{{ section.title }}</h3>
          <div
            v-else
            class="mb-2 border-t border-gray-200/80 dark:border-white/5"
          ></div>
          <nav class="space-y-1">
            <template v-for="item in section.items" :key="item.type === 'link' ? item.to : item.key">
              <!-- 单个普通菜单项 -->
              <UTooltip
                v-if="item.type === 'link'"
                :text="item.label"
                :disabled="!collapsed"
                :content="{ side: 'right' }"
              >
                <NuxtLink
                  :to="item.to"
                  class="group flex items-center gap-2.5 rounded-lg py-2.5 text-sm transition-colors"
                  :class="[
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive(item)
                      ? 'bg-gray-100 font-medium text-gray-900 dark:bg-[#1a1a1e] dark:text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white',
                  ]"
                >
                  <UIcon
                    :name="item.icon"
                    class="h-4 w-4 shrink-0"
                    :class="isActive(item) ? 'text-purple-500 dark:text-purple-400' : ''"
                  />
                  <span
                    v-if="!collapsed"
                    class="truncate"
                  >{{ item.label }}</span>
                </NuxtLink>
              </UTooltip>

              <!-- 折叠分组子菜单 -->
              <div v-else class="space-y-0.5">
                <!-- 宽栏展开模式 -->
                <template v-if="!collapsed">
                  <button
                    type="button"
                    class="group flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                    :class="isGroupActive(item)
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/[0.04] dark:hover:text-white'"
                    @click="toggleGroup(item.key)"
                  >
                    <div class="flex items-center gap-2.5 min-w-0 truncate">
                      <UIcon
                        :name="item.icon"
                        class="h-4 w-4 shrink-0"
                        :class="isGroupActive(item) ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400'"
                      />
                      <span class="truncate">{{ item.title }}</span>
                    </div>
                    <UIcon
                      name="ph:caret-down-bold"
                      class="h-3.5 w-3.5 shrink-0 transition-transform duration-200 opacity-60 group-hover:opacity-100"
                      :class="isGroupExpanded(item.key) ? 'rotate-0' : '-rotate-90'"
                    />
                  </button>

                  <!-- 子项列表 -->
                  <div
                    v-show="isGroupExpanded(item.key)"
                    class="ml-5 pl-2.5 space-y-0.5 border-l border-gray-200 dark:border-gray-800"
                  >
                    <NuxtLink
                      v-for="child in item.children"
                      :key="child.to"
                      :to="child.to"
                      class="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
                      :class="isActive(child)
                        ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white'"
                    >
                      <UIcon
                        :name="child.icon"
                        class="h-3.5 w-3.5 shrink-0"
                        :class="isActive(child) ? 'text-purple-600 dark:text-purple-400' : 'opacity-70'"
                      />
                      <span class="truncate">{{ child.label }}</span>
                    </NuxtLink>
                  </div>
                </template>

                <!-- 窄栏收起图标模式 -->
                <template v-else>
                  <UTooltip
                    :text="`${item.title} (${item.children.map(c => c.label).join(' · ')})`"
                    :content="{ side: 'right' }"
                  >
                    <button
                      type="button"
                      class="group flex w-full items-center justify-center rounded-lg py-2.5 text-sm transition-colors cursor-pointer"
                      :class="isGroupActive(item)
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white'"
                      @click="collapsed = false; openGroup(item.key)"
                    >
                      <UIcon
                        :name="item.icon"
                        class="h-4 w-4 shrink-0"
                        :class="isGroupActive(item) ? 'text-purple-500 dark:text-purple-400' : ''"
                      />
                    </button>
                  </UTooltip>
                </template>
              </div>
            </template>
          </nav>
        </div>
      </div>
    </div>

    <!-- 折叠开关:极简纯图标,极致省位 -->
    <div
      class="flex items-center border-t border-gray-200/80 p-2 dark:border-white/5"
      :class="collapsed ? 'justify-center' : 'justify-end px-3'"
    >
      <UTooltip
        :text="collapsed ? $t('admin.nav.expand', '展开侧边栏') : $t('admin.nav.collapse', '收起侧边栏')"
        :content="{ side: collapsed ? 'right' : 'top' }"
      >
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="collapsed = !collapsed"
        >
          <UIcon
            :name="collapsed ? 'ph:sidebar-simple-bold' : 'ph:sidebar-simple-bold'"
            class="h-4 w-4 shrink-0"
          />
        </button>
      </UTooltip>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const collapsed = defineModel<boolean>('collapsed', { default: false })

const route = useRoute()
const { extensionSections } = useAdminExtensions()
const { storeSection, configSection, resolveLabel, resolveSectionTitle, loadProductTypes, hasPermissionFor } = useAdminNav()
const { adminSectionTitleClass } = useAdminNavStyle()

interface NavSingleEntry {
  type: 'link'
  to: string
  icon: string
  label: string
  exact?: boolean
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

// 分组展开/折叠状态映射，默认所有分组均展开（未显式折叠即为展开）
const expandedGroups = ref<Record<string, boolean>>({})

const sections = computed(() => {
  const list: { key: string; title: string; items: NavItem[] }[] = [
    {
      key: 'store',
      title: resolveSectionTitle(storeSection),
      items: storeSection.items
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
                exact: child.exact,
              }))

            // 如果有多个有效子项（如包含全部商品、卡密、订阅等），渲染为折叠组
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
            exact: item.exact,
          }
        }),
    },
  ]

  extensionSections.value.forEach((section) => {
    const allowedExtensionPages = section.pages.filter(page =>
      hasPermissionFor(page.permissionCode || themeExtensionPermissionCode(page.extensionKey, page.key))
    )
    if (!allowedExtensionPages.length) return

    // 检查是否有分组配置
    const groupsMap = new Map<string, { title: string; icon: string; order: number; children: NavSingleEntry[] }>()
    const directItems: NavSingleEntry[] = []

    allowedExtensionPages.forEach((page) => {
      const entry: NavSingleEntry = {
        type: 'link',
        to: page.route,
        icon: page.icon,
        label: page.title,
        exact: true,
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

    const sectionItems: NavItem[] = [...directItems]
    for (const [key, group] of groupsMap.entries()) {
      sectionItems.push({
        type: 'group',
        key,
        title: group.title,
        icon: group.icon,
        order: group.order,
        children: group.children,
      })
    }

    // 排序：按 order 从小到大排
    sectionItems.sort((a, b) => {
      const orderA = a.order ?? 0
      const orderB = b.order ?? 0
      return orderA - orderB
    })

    list.push({
      key: `extensions-${section.key}`,
      title: section.title,
      items: sectionItems,
    })
  })

  list.push({
    key: 'config',
    title: resolveSectionTitle(configSection),
    items: configSection.items
      .filter(item => !item.conditional || item.conditional())
      .map(item => ({
        type: 'link' as const,
        to: item.to,
        icon: item.icon,
        label: resolveLabel(item),
        exact: item.exact,
      })),
  })

  return list
})

const isActive = (entry: NavSingleEntry) => {
  if (entry.exact) return route.path === entry.to
  return route.path === entry.to || route.path.startsWith(`${entry.to}/`)
}

const isGroupActive = (group: NavGroupEntry) => {
  return group.children.some(child => isActive(child))
}

const isGroupExpanded = (groupKey: string) => {
  return expandedGroups.value[groupKey] !== false
}

const toggleGroup = (groupKey: string) => {
  expandedGroups.value[groupKey] = !isGroupExpanded(groupKey)
}

const openGroup = (groupKey: string) => {
  expandedGroups.value[groupKey] = true
}

// 当路由切换到某个子项时，自动展开其所在的分组
watch(() => route.path, (currentPath) => {
  for (const section of sections.value) {
    for (const item of section.items) {
      if (item.type === 'group' && item.children.some(c => c.to === currentPath || currentPath.startsWith(`${c.to}/`))) {
        expandedGroups.value[item.key] = true
      }
    }
  }
}, { immediate: true })

onMounted(async () => {
  await loadProductTypes()
})
</script>

<style scoped>
.admin-sidebar-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.7) transparent;
}

.admin-sidebar-scrollbar::-webkit-scrollbar {
  width: 10px;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.7);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.9);
}

:global(.dark) .admin-sidebar-scrollbar {
  scrollbar-color: rgba(75, 85, 99, 0.85) transparent;
}

:global(.dark) .admin-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.85);
}

:global(.dark) .admin-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.95);
}
</style>
