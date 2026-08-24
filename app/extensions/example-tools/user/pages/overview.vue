<template>
  <div class="min-h-screen bg-[#050505] px-6 pb-20 pt-32 text-white">
    <div class="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 class="text-3xl font-bold">{{ isZh ? '示例工具' : 'Example Tools' }}</h1>
        <p class="mt-2 text-gray-400">{{ isZh ? '这是一个要求登录且不依赖当前主题的扩展用户页。' : 'This is a login-required extension page independent of the active theme.' }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div v-if="pending" class="h-20 animate-pulse rounded-xl bg-white/5"></div>
        <pre v-else class="overflow-auto text-sm text-gray-200">{{ data }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const isZh = computed(() => locale.value.startsWith('zh'))
const fetchProfile = $fetch as unknown as (request: string) => Promise<Record<string, unknown>>
const { data, pending } = await useAsyncData('example-tools-user-profile', () =>
  fetchProfile('/api/plugins/example-tools/profile'))
</script>
