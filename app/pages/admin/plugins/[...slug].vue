<template>
  <component v-if="page" :is="page.component" />
  <div v-else class="flex min-h-[60vh] items-center justify-center text-gray-500">
    {{ $t('admin.extensions.notFound') }}
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const { fetchSettings } = useSettings()
await fetchSettings()
const { findAdminPage } = useExtensions()
const page = computed(() => findAdminPage(route.path))

if (!page.value) setResponseStatus(404)

useHead(() => ({ title: `${page.value?.title || 'Extension'} - Admin` }))
</script>
