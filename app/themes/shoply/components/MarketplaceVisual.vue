<template>
  <div
    class="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[1.75rem] text-white"
    :style="{ background: `linear-gradient(135deg, ${accent}, #071e49)` }"
  >
    <img v-if="imageUrl" :src="imageUrl" :alt="name" class="absolute inset-0 h-full w-full object-cover" />
    <template v-else>
      <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15" />
      <div class="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-black/15" />
      <span class="relative text-5xl font-black tracking-tight sm:text-6xl">{{ mark }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ name: string, mark: string, accent: string, imageUrl?: string | null }>()
</script>
