<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ isZh ? '示例工具' : 'Example Tools' }}</h1>
      <p class="mt-2 text-gray-500 dark:text-gray-400">{{ isZh ? '这个页面由 app/extensions 提供，并调用同一 capability 保护的后台 API。' : 'This page is provided by app/extensions and calls an admin API protected by the same capability.' }}</p>
    </div>
    <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-[#121214]">
      <div v-if="pending" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
      <pre v-else class="overflow-auto text-sm text-gray-700 dark:text-gray-200">{{ data }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const isZh = computed(() => locale.value.startsWith('zh'))
const fetchStatus = $fetch as unknown as (request: string) => Promise<Record<string, unknown>>
const { data, pending } = await useAsyncData('example-tools-admin-status', () =>
  fetchStatus('/api/admin/plugins/example-tools/overview/status'))
</script>
