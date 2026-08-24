<template>
  <component v-if="page" :is="page.component" />
  <div v-else class="flex min-h-screen items-center justify-center bg-[#050505] text-gray-400">
    {{ $t('extensions.notFound') }}
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { fetchSettings } = useSettings()
await fetchSettings()
const { findUserPage } = useExtensions()
const page = computed(() => findUserPage(stripLocalePrefix(route.path)))

if (!page.value) setResponseStatus(404)

useHead(() => ({ title: page.value?.title || 'Extension' }))
</script>
