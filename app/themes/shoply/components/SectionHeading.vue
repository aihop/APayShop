<template>
  <div :class="align === 'left' ? 'max-w-2xl' : 'mx-auto max-w-3xl text-center'">
    <p class="text-xs font-black tracking-[0.18em] text-blue-600 uppercase">{{ label }}</p>
    <h2 class="mt-4 text-3xl font-black leading-tight tracking-[-0.035em] text-slate-900 sm:text-5xl">{{ title }}</h2>
    <p class="mt-5 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  title: string
  description: string
  align?: 'center' | 'left'
}>(), {
  align: 'center',
})
</script>
