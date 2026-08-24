<template>
  <MarketplaceList
    kind="theme"
    :entries="themes"
    :copy="copy"
    :eyebrow="copy.themes.eyebrow"
    :title="copy.themes.title"
    :description="copy.themes.description"
  />
</template>

<script setup lang="ts">
import { useShoplyMarketplace } from '../../composables/useShoplyMarketplace'

const { themes, copy } = useShoplyMarketplace()

useSeoMeta({
  title: () => copy.value.themes.seoTitle,
  description: () => copy.value.themes.seoDescription,
  ogTitle: () => copy.value.themes.seoTitle,
  ogDescription: () => copy.value.themes.seoDescription,
})
</script>
