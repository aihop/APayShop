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
        :key="activeTheme + targetFile"
      />
      <div
        v-else
        key="page-404"
        class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white"
      >
        <UIcon
          name="ph:file-dashed"
          class="w-24 h-24 text-gray-700 mb-6"
        />
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

const { getSetting } = useSettings()
const route = useRoute()

// ✅ 1. 关键：使用 eager: true 同步导入所有页面组件
// 这样 modules 里的值直接就是组件对象，而不是返回 Promise 的函数
const modules = import.meta.glob('../themes/**/pages/**/*.vue', {
  eager: true,
  import: 'default',
})

const activeTheme = computed(() => getSetting('active_theme') || 'default')
const pathSegments = computed(() => (route.params.slug as string[]) || [])

// 路径计算逻辑保持不变
const getFilePath = (segments: string[]) => {
  if (segments.length === 0) return 'index.vue'

  if (segments[0] === 'products') {
    if (segments.length === 1) return 'products/index.vue'
    if (segments.length === 2) return 'products/[slug].vue'
  }

  if (segments[0] === 'user') {
    if (segments[1] === 'orders') {
      if (segments.length === 2) return 'user/orders/index.vue'
      if (segments.length === 3) return 'user/orders/[order_id].vue'
    }
    if (segments[1] === 'invoice') {
      if (segments.length === 3) return 'user/invoice/[order_id].vue'
    }
  }

  if (segments[0] === 'blog') {
    if (segments.length === 1) return 'blog/index.vue'
    if (segments.length === 2) return 'blog/[slug].vue'
  }

  if (segments[0] === 'callback' && segments.length === 2) {
    if (segments[1] === 'cancel') {
      return 'callback/cancel.vue'
    }
    return 'callback/[order_id].vue'
  }

  if (segments[0] === 'docs') return 'docs.vue'

  return `${segments.join('/')}.vue`
}

const targetFile = computed(() => getFilePath(pathSegments.value))

// ✅ 2. 同步计算当前组件
// 不再使用 watch 和 shallowRef 异步赋值，而是直接 computed
const activeComponent = computed(() => {
  const file = targetFile.value
  const path = `../themes/${activeTheme.value}/pages/${file}`
  const fallback = `../themes/default/pages/${file}`

  // 直接从同步加载的 modules 中取值
  return modules[path] || modules[fallback] || null
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
      const remaining = Math.max(0, MIN_VISIBLE - elapsed)
      if (remaining > 0) await wait(remaining)
      if (token !== transitionToken) return
      isLoading.value = false
    }
  }
)

onBeforeUnmount(() => {
  if (loadingDelayTimer) {
    clearTimeout(loadingDelayTimer)
    loadingDelayTimer = null
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
