<template>
  <component
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

const { getSetting } = useSettings()

const activeTheme = computed(() => {
  const theme = getSetting('active_theme') || ''
  return themeBuild.publishedOptionalThemeSet.has(theme) ? theme : ''
})

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
