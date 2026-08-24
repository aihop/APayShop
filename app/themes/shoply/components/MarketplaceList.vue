<template>
  <main>
    <MarketplaceHero
      v-model="keyword"
      searchable
      :eyebrow="eyebrow"
      :title="title"
      :description="description"
      :search-placeholder="copy.common.search"
    />
    <section class="px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
      <div class="mx-auto max-w-[1440px]">
        <div class="flex gap-2 overflow-x-auto pb-3">
          <button
            v-for="category in categories"
            :key="category.value"
            type="button"
            class="shrink-0 rounded-full px-5 py-2.5 text-sm font-black transition"
            :class="selectedCategory === category.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'"
            @click="selectedCategory = category.value"
          >{{ category.label }}</button>
        </div>

        <div v-if="pageEntries.length" class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MarketplaceCard
            v-for="entry in pageEntries"
            :key="`${entry.kind}:${entry.slug}`"
            :entry="entry"
            :to="localePath(`/${kind === 'app' ? 'apps' : 'theme'}/${entry.slug}`)"
            :category="categoryLabel(entry.category)"
            :price="entry.price ? formatAmount(entry.price) : copy.common.free"
            :details-label="copy.common.details"
            :downloads-label="copy.common.downloads"
          />
        </div>
        <div v-else class="mt-8 rounded-[2rem] border border-dashed border-slate-300 px-6 py-24 text-center text-slate-500">{{ copy.common.empty }}</div>

        <div v-if="pageCount > 1" class="mt-10 flex items-center justify-center gap-4">
          <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold disabled:opacity-40" :disabled="page === 1" @click="page--">{{ copy.common.previous }}</button>
          <span class="text-sm font-black text-slate-600">{{ page }} / {{ pageCount }}</span>
          <button type="button" class="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold disabled:opacity-40" :disabled="page === pageCount" @click="page++">{{ copy.common.next }}</button>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ShoplyMarketplaceCopy } from '../locales/marketplace'
import type { ShoplyMarketplaceEntry, ShoplyMarketplaceKind } from '../types/marketplace'

const props = defineProps<{
  kind: ShoplyMarketplaceKind
  entries: ShoplyMarketplaceEntry[]
  copy: ShoplyMarketplaceCopy
  eyebrow: string
  title: string
  description: string
}>()

const { localePath } = useLocaleRouter()
const { formatAmount } = useLocaleCurrency()
const keyword = ref('')
const selectedCategory = ref('all')
const page = ref(1)
const pageSize = 12

const categoryLabel = (category: string) => props.kind === 'app'
  ? props.copy.appCategories[category]?.[0] || category
  : props.copy.themeCategories[category] || category

const categories = computed(() => [
  { value: 'all', label: props.copy.common.all },
  ...Array.from(new Set(props.entries.map(entry => entry.category))).map(category => ({ value: category, label: categoryLabel(category) })),
])

const filteredEntries = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLocaleLowerCase()
  return props.entries.filter(entry => {
    if (selectedCategory.value !== 'all' && entry.category !== selectedCategory.value) return false
    if (!normalizedKeyword) return true
    return `${entry.name} ${entry.summary} ${entry.category}`.toLocaleLowerCase().includes(normalizedKeyword)
  })
})
const pageCount = computed(() => Math.max(Math.ceil(filteredEntries.value.length / pageSize), 1))
const pageEntries = computed(() => filteredEntries.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([keyword, selectedCategory], () => { page.value = 1 })
</script>
