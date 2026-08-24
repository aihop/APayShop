<template>
  <section class="relative overflow-hidden bg-[#071e49] px-5 pb-20 pt-32 text-white sm:px-8 sm:pb-24 sm:pt-40 lg:px-12">
    <div class="absolute inset-0 opacity-45" style="background-image: radial-gradient(circle at 18% 20%, #2f7cff 0, transparent 34%), radial-gradient(circle at 82% 70%, #17b8ff 0, transparent 28%);" />
    <div class="relative mx-auto max-w-5xl text-center">
      <p class="text-xs font-black tracking-[0.25em] text-blue-200 sm:text-sm">{{ eyebrow }}</p>
      <h1 class="mx-auto mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{{ title }}</h1>
      <p class="mx-auto mt-6 max-w-3xl text-base leading-8 text-blue-100/80 sm:text-lg">{{ description }}</p>
      <label v-if="searchable" class="mx-auto mt-10 flex max-w-2xl items-center gap-3 rounded-2xl bg-white p-2 pl-5 shadow-2xl shadow-black/20">
        <span aria-hidden="true" class="text-xl text-slate-400">⌕</span>
        <span class="sr-only">{{ searchPlaceholder }}</span>
        <input
          :value="modelValue"
          type="search"
          class="min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-slate-900 outline-none"
          :placeholder="searchPlaceholder"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  modelValue?: string
  searchPlaceholder?: string
  searchable?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
