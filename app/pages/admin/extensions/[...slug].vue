<template>
  <component
    v-if="activeComponent"
    :is="activeComponent"
  />
  <div
    v-else
    class="h-[calc(100vh-10rem)] flex items-center justify-center"
  >
    <div class="max-w-xl w-full bg-[#121214] border border-gray-800/50 rounded-2xl p-8 text-center">
      <UIcon
        name="ph:puzzle-piece"
        class="w-12 h-12 text-purple-400 mx-auto mb-4"
      />
      <h1 class="text-2xl font-bold text-white">{{ title }}</h1>
      <p class="text-gray-400 mt-3">{{ description }}</p>
      <div class="flex items-center justify-center gap-3 mt-6">
        <UButton
          to="/admin/themes"
          color="neutral"
          variant="outline"
        >Theme Center</UButton>
        <UButton
          to="/admin"
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white"
        >Back to Dashboard</UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const themeAdminLocaleEnModules = import.meta.glob('../../../themes/**/locales/admin/en.ts', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, any>>

const themeAdminLocaleZhModules = import.meta.glob('../../../themes/**/locales/admin/zh.ts', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, any>>

const route = useRoute()
const { activeTheme, findExtensionPage, resolveExtensionComponent } = useAdminExtensions()
const { mergeLocaleMessage } = useI18n()

const currentPath = computed(() => route.path)
const currentPage = computed(() => findExtensionPage(currentPath.value))
const activeComponent = computed(() => resolveExtensionComponent(currentPath.value))

const title = computed(() => currentPage.value?.title || 'Theme Extension')
const description = computed(
  () => currentPage.value?.description || `No extension page is registered for ${activeTheme.value}.`
)

watchEffect(() => {
  const theme = activeTheme.value
  if (!theme || !mergeLocaleMessage) {
    return
  }

  const en = themeAdminLocaleEnModules[`../../../themes/${theme}/locales/admin/en.ts`]
  const zh = themeAdminLocaleZhModules[`../../../themes/${theme}/locales/admin/zh.ts`]

  if (en) {
    mergeLocaleMessage('en', {
      [theme]: {
        admin: en,
      },
    })
  }

  if (zh) {
    mergeLocaleMessage('zh', {
      [theme]: {
        admin: zh,
      },
    })
  }
})

useHead(() => ({
  title: `${title.value} - Admin`,
}))
</script>
