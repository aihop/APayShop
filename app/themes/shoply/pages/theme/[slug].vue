<template>
  <MarketplaceDetail kind="theme" :entry="entry" :copy="copy" :category="category" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useShoplyMarketplace } from '../../composables/useShoplyMarketplace'

const route = useRoute()
const { findEntry, copy } = useShoplyMarketplace()
const slug = computed(() => {
  const value = route.params.slug
  return Array.isArray(value) ? String(value.at(-1) || '') : String(value || '')
})
const entry = computed(() => findEntry('theme', slug.value))
const category = computed(() => entry.value ? copy.value.themeCategories[entry.value.category as keyof typeof copy.value.themeCategories] || entry.value.category : '')

if (!entry.value) setResponseStatus(404)

useSeoMeta({
  title: () => entry.value ? `${entry.value.name} | ${copy.value.themes.seoTitle}` : copy.value.common.notFound,
  description: () => entry.value?.summary || copy.value.themes.seoDescription,
  ogTitle: () => entry.value?.name || copy.value.common.notFound,
  ogDescription: () => entry.value?.summary || copy.value.themes.seoDescription,
  ogImage: () => entry.value?.imageUrl || undefined,
})
</script>
