<template>
  <!-- 多根组件:两个块都是父级 grid(lg:grid-cols-12)的直接子元素 -->
  <!-- Mobile: 横向滚动条 -->
  <div class="settings-nav-scroll block lg:hidden overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
    <nav class="flex space-x-2">
      <component
        :is="tab.route ? NuxtLink : 'button'"
        v-for="tab in SETTINGS_NAV_TABS"
        :key="tab.id"
        :to="tab.route"
        :type="tab.route ? undefined : 'button'"
        class="shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        :class="active === tab.id
          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'"
        @click="onSelect(tab)"
      >
        <UIcon
          :name="tab.icon"
          class="w-5 h-5"
        />
        {{ $t(tab.labelKey) }}
      </component>
    </nav>
  </div>

  <!-- Desktop: 左栏导航 -->
  <div class="lg:col-span-3 hidden lg:block space-y-1">
    <nav class="sticky top-24 space-y-2">
      <component
        :is="tab.route ? NuxtLink : 'button'"
        v-for="tab in SETTINGS_NAV_TABS"
        :key="tab.id"
        :to="tab.route"
        :type="tab.route ? undefined : 'button'"
        class="w-full text-left block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        :class="active === tab.id
          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'"
        @click="onSelect(tab)"
      >
        <div class="flex items-center gap-3">
          <UIcon
            :name="tab.icon"
            class="w-5 h-5"
          />
          {{ $t(tab.labelKey) }}
        </div>
      </component>
    </nav>
  </div>
</template>

<script setup lang="ts">
// 设置族共享导航:settings 页与路由型成员页(themes)套同一副左栏,
// 页内 tab 走 select 事件,路由型条目直接 NuxtLink 跳转。
// 清单单点在 ./nav-tabs.ts,别在这里私加条目。
import { resolveComponent } from 'vue'
import { SETTINGS_NAV_TABS, type SettingsNavTab } from './nav-tabs'

defineProps<{
  /** 当前高亮条目 id:settings 页传 activeTab,成员页传自己的 id(如 'themes') */
  active: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const NuxtLink = resolveComponent('NuxtLink')

const onSelect = (tab: SettingsNavTab) => {
  // 路由型条目由 NuxtLink 自行导航,不发 select
  if (!tab.route) emit('select', tab.id)
}
</script>

<style scoped>
/* 原 settings.vue 引用的 hide-scrollbar 类从未被定义过,这里补上真实现 */
.settings-nav-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.settings-nav-scroll::-webkit-scrollbar {
  display: none;
}
</style>
