<template>
  <NuxtLink
    :to="to"
    class="group flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
  >
    <MarketplaceVisual :name="entry.name" :mark="entry.mark" :accent="entry.accent" :image-url="entry.imageUrl" />
    <div class="flex flex-1 flex-col px-2 pb-2 pt-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{{ category }}</p>
          <h2 class="mt-2 text-xl font-black text-slate-950 group-hover:text-blue-600">{{ entry.name }}</h2>
        </div>
        <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{{ price }}</span>
      </div>
      <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{{ entry.summary }}</p>
      <div class="mt-auto flex items-center justify-between pt-5 text-xs font-bold text-slate-400">
        <span v-if="entry.kind === 'app'">{{ entry.downloads || 0 }} {{ downloadsLabel }}</span>
        <span v-else>{{ detailsLabel }}</span>
        <span class="text-blue-600 transition-transform group-hover:translate-x-1">→</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { ShoplyMarketplaceEntry } from '../types/marketplace'

defineProps<{
  entry: ShoplyMarketplaceEntry
  to: string
  category: string
  price: string
  detailsLabel: string
  downloadsLabel: string
}>()
</script>
