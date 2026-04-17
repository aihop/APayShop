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

useAsyncData('global-settings', () => fetchSettings())
</script>
