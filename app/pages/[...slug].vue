<template>
  <NuxtErrorBoundary>
    <Transition
      name="page-fade"
      mode="out-in"
    >
      <div
        v-if="isLoading"
        key="page-loading"
        class="min-h-screen flex items-center justify-center bg-[#0A0A0A]"
      >
        <div class="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <component
        v-else-if="activeComponent"
        :is="activeComponent"
        :key="(activeTheme || '_core_') + targetFile"
      ></component>
      <div
        v-else
        key="page-404"
        class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white"
      >
        <UIcon
          name="ph:file-dashed"
          class="w-24 h-24 text-gray-700 mb-6"
        ></UIcon>
        <h1 class="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p class="text-gray-400 mb-8">The page you are looking for does not exist in this template.</p>
        <UButton
          to="/"
          color="primary"
          class="bg-purple-600 hover:bg-purple-500"
        >Return Home</UButton>
      </div>
    </Transition>

    <!-- Error Boundary Fallback -->
    <template #error="{ error, clearError }">
      <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8">
        <UIcon
          name="ph:warning-circle-bold"
          class="w-24 h-24 text-red-500 mb-6"
        />
        <h1 class="text-4xl font-bold mb-4 text-center">Oops! Something went wrong.</h1>
        <p class="text-gray-400 mb-8 max-w-lg text-center">
          We encountered an unexpected error while loading this page. Our team has been notified.
        </p>
        <div class="bg-black/50 p-4 rounded-xl border border-red-500/20 mb-8 max-w-2xl w-full overflow-auto">
          <code class="text-sm text-red-400">{{ error }}</code>
        </div>
        <div class="flex gap-4">
          <UButton
            @click="clearError"
            color="primary"
            variant="outline"
          >
            Try Again
          </UButton>
          <UButton
            to="/"
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
          >
            Return Home
          </UButton>
        </div>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 兼容处理：如果 URL 包含 .vue 或以 /index 结尾，重定向到清理后的规范路径
const cleanPath = route.path.replace(/\.vue$/, '').replace(/\/index$/, '')
if (cleanPath !== route.path) {
  navigateTo({ path: cleanPath || '/', query: route.query }, { replace: true })
}

const { getSetting } = useSettings()

// ✅ 1. 关键：使用 eager: true 同步导入所有组件
// core: 系统默认渲染层（原 default 主题）
// themes: 可选主题，可覆盖 core 的页面
const coreModules = import.meta.glob('../core/pages/**/*.vue', {
  eager: true,
  import: 'default',
})

const themeModules = import.meta.glob('../themes/**/pages/**/*.vue', {
  eager: true,
  import: 'default',
})

// 合并：theme 同名文件会覆盖 core，实现主题页面替换系统默认页面的效果
const modules = { ...coreModules, ...themeModules }

// 自动提取所有可用的路由模板路径 (e.g. 'user/orders/index.vue', 'products/[slug].vue')
const routeTemplates = Array.from(
  new Set(
    Object.keys(modules)
      .map(key => key.split('/pages/')[1])
      .filter((path): path is string => Boolean(path))
  )
)

const activeTheme = computed(() => getSetting('active_theme') || '')

const pathSegments = computed(() => (route.params.slug as string[]) || [])

// 自动匹配路径逻辑：无主题时走 core，有主题时优先查主题然后 fallback 到 core
const getFilePath = (segments: string[], theme: string) => {
  if (segments.length === 0) return 'index.vue'

  const pathStr = segments.join('/')

  const existsInCore = (file: string) => {
    return !!coreModules[`../core/pages/${file}`]
  }

  const existsInTheme = (file: string, t: string) => {
    return !!themeModules[`../themes/${t}/pages/${file}`]
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

// ✅ 2. 同步计算当前组件
const activeComponent = computed(() => {
  const file = targetFile.value
  // 有主题时先查主题
  if (activeTheme.value) {
    const themePath = `../themes/${activeTheme.value}/pages/${file}`
    if (themeModules[themePath]) return themeModules[themePath]
  }
  // fallback 到 core
  return coreModules[`../core/pages/${file}`] || null
})

const isLoading = ref(false)
const LOADING_DELAY = 120
const MIN_VISIBLE = 240
let loadingDelayTimer: ReturnType<typeof setTimeout> | null = null
let loadingShownAt = 0
let transitionToken = 0

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

watch(
  () => [route.fullPath, activeTheme.value, targetFile.value],
  async () => {
    transitionToken += 1
    const token = transitionToken

    if (loadingDelayTimer) {
      clearTimeout(loadingDelayTimer)
      loadingDelayTimer = null
    }

    loadingDelayTimer = setTimeout(() => {
      if (token !== transitionToken) return
      isLoading.value = true
      loadingShownAt = Date.now()
    }, LOADING_DELAY)

    await nextTick()
    await wait(16)

    if (token !== transitionToken) return

    if (loadingDelayTimer) {
      clearTimeout(loadingDelayTimer)
      loadingDelayTimer = null
    }

    if (isLoading.value) {
      const elapsed = Date.now() - loadingShownAt
      if (elapsed < MIN_VISIBLE) {
        await wait(MIN_VISIBLE - elapsed)
      }
    }

    if (token !== transitionToken) return
    isLoading.value = false
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (loadingDelayTimer) {
    clearTimeout(loadingDelayTimer)
  }
})
</script>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
