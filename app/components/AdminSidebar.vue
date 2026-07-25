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
            <UTooltip
              v-for="entry in section.entries"
              :key="entry.to"
              :text="entry.label"
              :disabled="!collapsed"
              :content="{ side: 'right' }"
            >
              <NuxtLink
                :to="entry.to"
                class="group flex items-center gap-2.5 rounded-lg py-2.5 text-sm transition-colors"
                :class="[
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive(entry)
                    ? 'bg-gray-100 text-gray-900 dark:bg-[#1a1a1e] dark:text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white',
                ]"
              >
                <UIcon
                  :name="entry.icon"
                  class="h-4 w-4 shrink-0"
                  :class="isActive(entry) ? 'text-purple-500 dark:text-purple-400' : ''"
                />
                <span
                  v-if="!collapsed"
                  class="truncate"
                >{{ entry.label }}</span>
              </NuxtLink>
            </UTooltip>
          </nav>
        </div>
      </div>
    </div>

    <!-- 折叠开关:置底常驻,状态由 layouts/admin.vue 经 v-model 持有(cookie 持久化) -->
    <div class="border-t border-gray-200/80 p-3 dark:border-white/5">
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/40 dark:hover:bg-white/[0.04] dark:hover:text-white"
        :class="collapsed ? 'justify-center px-0' : 'px-3'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      >
        <UIcon
          :name="collapsed ? 'ph:caret-double-right-bold' : 'ph:caret-double-left-bold'"
          class="h-4 w-4 shrink-0"
        />
        <span v-if="!collapsed">{{ $t('admin.nav.collapse') }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
// 后台侧边导航:2026-07 参照 qingpu 用户中心改为 fixed 贴边全高,
// 支持折叠成 64px 图标栏(tooltip 显示条目名)。此前是居中容器内的
// sticky 内嵌栏,与内容粘连、大屏留白浪费。
// 三段导航(商店/主题扩展/配置)归一成 sections 统一渲染,active 判定
// 用路径前缀(admin 路由无 i18n 前缀,直接比较即可),不再依赖
// NuxtLink active-class——图标颜色需要与链接同步高亮,类选择器做不到。
import { computed, onMounted } from 'vue'

const collapsed = defineModel<boolean>('collapsed', { default: false })

const route = useRoute()
const { extensionPages, themeSectionTitle } = useAdminExtensions()
const { storeSection, configSection, resolveLabel, resolveSectionTitle, loadProductTypes } = useAdminNav()
const { adminSectionTitleClass } = useAdminNavStyle()

interface NavEntry {
  to: string
  icon: string
  label: string
  exact?: boolean
}

const sections = computed(() => {
  const list: { key: string; title: string; entries: NavEntry[] }[] = [
    {
      key: 'store',
      // storeSection/configSection 是 useAdminNav 返回的普通对象(非 ref),不解 .value
      title: resolveSectionTitle(storeSection),
      entries: storeSection.items
        .filter(item => !item.conditional || item.conditional())
        .map(item => ({ to: item.to, icon: item.icon, label: resolveLabel(item), exact: item.exact })),
    },
  ]

  if (extensionPages.value.length) {
    list.push({
      key: 'extensions',
      title: themeSectionTitle.value,
      entries: extensionPages.value.map(page => ({ to: page.route, icon: page.icon, label: page.title, exact: true })),
    })
  }

  list.push({
    key: 'config',
    title: resolveSectionTitle(configSection),
    entries: configSection.items
      .filter(item => !item.conditional || item.conditional())
      .map(item => ({ to: item.to, icon: item.icon, label: resolveLabel(item), exact: item.exact })),
  })

  return list
})

const isActive = (entry: NavEntry) => {
  if (entry.exact) return route.path === entry.to
  return route.path === entry.to || route.path.startsWith(`${entry.to}/`)
}

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
