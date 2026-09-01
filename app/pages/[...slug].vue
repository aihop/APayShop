<template>
  <NuxtErrorBoundary>
    <component
      v-if="activeComponent && activeDirectoryLayout"
      :is="activeDirectoryLayout.component"
      :key="activeDirectoryLayout.key"
    >
      <component
        :is="activeComponent"
        :key="activePageKey"
      />
    </component>
    <component
      v-else-if="activeComponent"
      :is="activeComponent"
      :key="activePageKey"
    />
    <div
      v-else
      key="page-404"
      class="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white px-6 transition-colors duration-300"
    >
      <UIcon
        name="ph:file-dashed"
        class="w-24 h-24 text-gray-300 dark:text-gray-700 mb-6 transition-colors duration-300"
      ></UIcon>
      <h1 class="text-4xl font-bold mb-4">{{ t('routeFallback.notFoundTitle') }}</h1>
      <p class="text-gray-500 dark:text-gray-400 mb-8 text-center transition-colors duration-300">{{ t('routeFallback.notFoundDescription') }}</p>
      <UButton
        to="/"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white dark:text-white"
      >{{ t('routeFallback.returnHome') }}</UButton>
    </div>

    <!-- Error Boundary Fallback -->
    <template #error="{ error, clearError }">
      <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white p-8 transition-colors duration-300">
        <UIcon
          name="ph:warning-circle-bold"
          class="w-24 h-24 text-red-500 mb-6"
        />
        <h1 class="text-4xl font-bold mb-4 text-center">{{ t('routeFallback.errorTitle') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mb-8 max-w-lg text-center transition-colors duration-300">
          {{ t('routeFallback.errorDescription') }}
        </p>
        <div class="bg-white border border-red-200 dark:bg-black/40 dark:border-red-500/20 p-4 rounded-xl mb-8 max-w-2xl w-full overflow-auto shadow-sm dark:shadow-none transition-colors duration-300">
          <code class="text-sm text-red-500 dark:text-red-400">{{ error }}</code>
        </div>
        <div class="flex gap-4">
          <UButton
            @click="clearError"
            color="primary"
            variant="outline"
            class="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
          >
            {{ t('routeFallback.tryAgain') }}
          </UButton>
          <UButton
            to="/"
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {{ t('routeFallback.returnHome') }}
          </UButton>
        </div>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import * as themeBuild from '~/generated/theme-build'

const route = useRoute()
const { t } = useI18n()

// 兼容处理：如果 URL 包含 .vue 或以 /index 结尾，重定向到清理后的规范路径
const cleanPath = route.path.replace(/\.vue$/, '').replace(/\/index$/, '')
if (cleanPath !== route.path) {
  navigateTo({ path: cleanPath || '/', query: route.query }, { replace: true })
}

const { getSetting } = useSettings()

// 合并：theme 同名文件会覆盖 core，实现主题页面替换系统默认页面的效果
const modules = { ...themeBuild.corePageModules, ...themeBuild.themePageModules }

// 自动提取所有可用的路由模板路径 (e.g. 'user/orders/index.vue', 'products/[slug].vue')
const routeTemplates = Array.from(
  new Set(
    Object.keys(modules)
      .map(key => key.split('/pages/')[1])
      .filter((path): path is string => Boolean(path))
  )
)

const activeTheme = useActiveTheme()

const pathSegments = computed(() => (route.params.slug as string[]) || [])

// 自动匹配路径逻辑：无主题时走 core，有主题时优先查主题然后 fallback 到 core
const getFilePath = (segments: string[], theme: string) => {
  if (segments.length === 0) return 'index.vue'

  const pathStr = segments.join('/')

  const existsInCore = (file: string) => {
    return !!themeBuild.corePageModules[`../core/pages/${file}`]
  }

  const existsInTheme = (file: string, t: string) => {
    return !!themeBuild.themePageModules[`../themes/${t}/pages/${file}`]
  }

  // 1. 如果有设置主题，优先在主题中查找精确匹配
  if (theme) {
    if (existsInTheme(`${pathStr}.vue`, theme)) return `${pathStr}.vue`
    if (existsInTheme(`${pathStr}/index.vue`, theme)) return `${pathStr}/index.vue`
  }

  // 2. 在 core（系统默认）中查找精确匹配
  if (existsInCore(`${pathStr}.vue`)) return `${pathStr}.vue`
  if (existsInCore(`${pathStr}/index.vue`)) return `${pathStr}/index.vue`

  const exists = (file: string) => {
    if (theme && existsInTheme(file, theme)) return true
    return existsInCore(file)
  }

  // 3. 匹配动态路由 (e.g. products/123 -> products/[slug].vue)
  for (const template of routeTemplates) {
    const templateSegments = template.replace(/\.vue$/, '').split('/')
    if (templateSegments.length === segments.length) {
      let isMatch = true
      for (let i = 0; i < segments.length; i++) {
        const tSegment = templateSegments[i]
        if (!tSegment) {
          isMatch = false
          break
        }
        const isDynamic = tSegment.startsWith('[') && tSegment.endsWith(']')
        if (!isDynamic && tSegment !== segments[i]) {
          isMatch = false
          break
        }
      }
      if (isMatch && exists(template)) return template
    }
  }

  // 兜底返回
  return `${pathStr}.vue`
}

const targetFile = computed(() => getFilePath(pathSegments.value, activeTheme.value))

const asyncThemePageCache = new Map<string, any>()
const resolvePageComponent = (modOrLoader: any, key: string) => {
  if (!modOrLoader) return null
  if (typeof modOrLoader === 'function') {
    if (!asyncThemePageCache.has(key)) {
      asyncThemePageCache.set(key, defineAsyncComponent(modOrLoader))
    }
    return asyncThemePageCache.get(key)
  }
  return modOrLoader.default || modOrLoader
}

// ✅ 2. 动态/异步计算当前组件
const activeComponent = computed(() => {
  const file = targetFile.value
  // 有主题时先查主题
  if (activeTheme.value) {
    const themePath = `../themes/${activeTheme.value}/pages/${file}`
    const mod = themeBuild.themePageModules[themePath]
    if (mod) return resolvePageComponent(mod, themePath)
  }
  // fallback 到 core
  const corePath = `../core/pages/${file}`
  const coreMod = themeBuild.corePageModules[corePath]
  if (coreMod) return resolvePageComponent(coreMod, corePath)
  return null
})

const activePageKey = computed(() => `${activeTheme.value || '_core_'}:${targetFile.value}:${route.path}`)

const activeDirectoryLayout = computed(() => {
  const file = targetFile.value
  const segments = file.split('/')
  segments.pop()

  while (segments.length > 0) {
    const layoutFile = `${segments.join('/')}/layout.vue`
    if (layoutFile !== file) {
      if (activeTheme.value) {
        const themePath = `../themes/${activeTheme.value}/pages/${layoutFile}`
        const themeLayout = themeBuild.themePageModules[themePath] as any
        if (themeLayout) {
          const comp = resolvePageComponent(themeLayout, themePath)
          if (comp) {
            return {
              component: comp,
              key: `${activeTheme.value}:${layoutFile}`,
            }
          }
        }
      }

      const corePath = `../core/pages/${layoutFile}`
      const coreLayout = themeBuild.corePageModules[corePath] as any
      if (coreLayout) {
        const comp = resolvePageComponent(coreLayout, corePath)
        if (comp) {
          return {
            component: comp,
            key: `_core_:${layoutFile}`,
          }
        }
      }
    }
    segments.pop()
  }

  return null
})

if (!activeComponent.value) {
  setResponseStatus(404)
}
</script>
