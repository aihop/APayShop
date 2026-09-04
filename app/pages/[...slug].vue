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
import { computed, shallowRef, watch } from 'vue'
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

const loadedComponentCache = new Map<string, Promise<any>>()

const loadComponentModule = async (modOrLoader: any, key: string) => {
  if (!modOrLoader) return null
  if (typeof modOrLoader === 'function') {
    if (!loadedComponentCache.has(key)) {
      const loadPromise = (async () => {
        try {
          const loaded = await modOrLoader()
          return loaded?.default || loaded
        } catch (err) {
          loadedComponentCache.delete(key)
          throw err
        }
      })()
      loadedComponentCache.set(key, loadPromise)
    }
    return await loadedComponentCache.get(key)
  }
  return modOrLoader?.default || modOrLoader
}

const resolvePageModule = (file: string, theme: string) => {
  if (theme) {
    const themePath = `../themes/${theme}/pages/${file}`
    const mod = themeBuild.themePageModules[themePath]
    if (mod) return { mod, key: themePath }
  }
  const corePath = `../core/pages/${file}`
  const coreMod = themeBuild.corePageModules[corePath]
  if (coreMod) return { mod: coreMod, key: corePath }
  return null
}

const resolveDirectoryLayoutModule = (file: string, theme: string) => {
  const segments = file.split('/')
  segments.pop()

  while (segments.length > 0) {
    const layoutFile = `${segments.join('/')}/layout.vue`
    if (layoutFile !== file) {
      if (theme) {
        const themePath = `../themes/${theme}/pages/${layoutFile}`
        const themeLayout = themeBuild.themePageModules[themePath] as any
        if (themeLayout) {
          return { mod: themeLayout, key: `${theme}:${layoutFile}` }
        }
      }

      const corePath = `../core/pages/${layoutFile}`
      const coreLayout = themeBuild.corePageModules[corePath] as any
      if (coreLayout) {
        return { mod: coreLayout, key: `_core_:${layoutFile}` }
      }
    }
    segments.pop()
  }

  return null
}

const activeComponent = shallowRef<any>(null)
const activeDirectoryLayout = shallowRef<{ component: any, key: string } | null>(null)

const activePageKey = computed(() => `${activeTheme.value || '_core_'}:${targetFile.value}:${route.path}`)

const updateActiveComponents = async () => {
  const file = targetFile.value
  const theme = activeTheme.value

  const pageInfo = resolvePageModule(file, theme)
  const dirLayoutInfo = resolveDirectoryLayoutModule(file, theme)

  try {
    const [pageComp, dirComp] = await Promise.all([
      pageInfo ? loadComponentModule(pageInfo.mod, pageInfo.key) : Promise.resolve(null),
      dirLayoutInfo ? loadComponentModule(dirLayoutInfo.mod, dirLayoutInfo.key) : Promise.resolve(null),
    ])

    activeComponent.value = pageComp
    activeDirectoryLayout.value = dirComp ? { component: dirComp, key: dirLayoutInfo!.key } : null
  } catch (err) {
    console.error('Failed to load page component:', err)
    activeComponent.value = null
    activeDirectoryLayout.value = null
  }

  if (!activeComponent.value) {
    setResponseStatus(404)
  }
}

// 顶层 await：让 SSR 服务端渲染与客户端路由 Suspense 真正等待组件加载完成
await updateActiveComponents()

// 当路由在客户端复用 [...slug].vue 实例时，动态切换目标组件
watch([() => route.path, activeTheme], async () => {
  await updateActiveComponents()
})
</script>
