<template>
  <UApp>
    <NuxtLoadingIndicator color="#6366f1" :height="2" :throttle="100" />
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

await useAsyncData('global-settings', () => fetchSettings())

useHead(() => {
  const title = route.meta.title || 'APay'
  return {
    title: title,
    titleTemplate: title === 'APay' ? '%s' : '%s - APay'
  }
})
</script>
