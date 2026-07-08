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
  const title = route.meta.title || 'APayShop'
  return {
    title: title,
    titleTemplate: title === 'APayShop' ? '%s' : '%s - APayShop'
  }
})
</script>
