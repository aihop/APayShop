<template>
  <section class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black/10">
    <h4 class="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
      <UIcon :name="icon" class="h-4 w-4 text-purple-500" />{{ title }}
    </h4>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; icon: string }>()
</script>
