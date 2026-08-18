<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConfirmModal />
    <SessionReplacedModal />
  </UApp>
</template>

<script setup lang="ts">
const { fetchSettings } = useSettings()
const route = useRoute()
const { start: startWebSessionMonitor, stop: stopWebSessionMonitor } = useWebSessionMonitor()

onMounted(startWebSessionMonitor)
onBeforeUnmount(stopWebSessionMonitor)

useAsyncData('global-settings', () => fetchSettings())

useHead(() => {
  const title = route.meta.title || 'APay'
  return {
    title: title,
    titleTemplate: title === 'APay' ? '%s' : '%s - APay'
  }
})
</script>
