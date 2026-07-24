<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConfirmModal />
  </UApp>
</template>

<script setup lang="ts">
const { fetchSettings } = useSettings()
const route = useRoute()

useAsyncData('global-settings', () => fetchSettings())

useHead(() => {
  const title = route.meta.title || 'APay'
  return {
    title: title,
    titleTemplate: title === 'APay' ? '%s' : '%s - APay'
  }
})
</script>
