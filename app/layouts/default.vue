<template>
  <div v-if="isBareLayout" class="min-h-0 bg-transparent">
    <slot />
  </div>
  <component
    v-else
    :is="activeLayout"
    :key="activeTheme"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
// 前台主题分发器:按 active_theme 动态加载主题 layout,失败/未激活时
// 兜底 core 布局。admin 页面已通过 definePageMeta({ layout: 'admin' })
// 直连 layouts/admin.vue(2026-07 拆分),不再进入本分发器。
import { computed, defineAsyncComponent } from 'vue'
import * as themeBuild from '~/generated/theme-build'

const route = useRoute()
const isBareLayout = computed(() => {
  const path = route.path || ''
  return path.startsWith('/payment/mini') || route.meta?.layout === false
})

// 主题解析与页面分发器(app/pages/[...slug].vue)共用 useActiveTheme:
// devTheme(APAY_DEV_THEME/NUXT_PUBLIC_DEV_THEME) > settings.active_theme。
// 这里曾自行只读 settings.active_theme,导致 dev 下页面走目标主题、布局却回落 core。
const activeTheme = useActiveTheme()

// Dynamic layout loader
const activeLayout = computed(() => {
  return defineAsyncComponent(() => {
    if (!activeTheme.value) return import('../core/layouts/default.vue')
    const loadThemeLayout = themeBuild.themeLayoutLoaders[activeTheme.value] as
      | (() => Promise<{ default: unknown }>)
      | undefined
    if (!loadThemeLayout) {
      return import('../core/layouts/default.vue')
    }
    return loadThemeLayout().catch(() => {
      return import('../core/layouts/default.vue')
    })
  })
})
</script>
