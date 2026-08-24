<template>
  <MarketplaceList
    kind="app"
    :entries="apps"
    :copy="copy"
    :eyebrow="copy.apps.eyebrow"
    :title="copy.apps.title"
    :description="copy.apps.description"
  />
</template>

<script setup lang="ts">
import { useShoplyMarketplace } from '../../composables/useShoplyMarketplace'

const { apps, copy } = useShoplyMarketplace()

useSeoMeta({
  title: () => copy.value.apps.seoTitle,
  description: () => copy.value.apps.seoDescription,
  ogTitle: () => copy.value.apps.seoTitle,
  ogDescription: () => copy.value.apps.seoDescription,
})
</script>
