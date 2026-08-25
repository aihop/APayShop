<template>
  <main v-if="entry" class="px-5 pb-20 pt-28 sm:px-8 sm:pt-36 lg:px-12">
    <div class="mx-auto max-w-6xl">
      <NuxtLink :to="localePath(`/${entry.kind === 'app' ? 'apps' : 'theme'}`)" class="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">← {{ copy.common.back }}</NuxtLink>
      <section class="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
        <div>
          <MarketplaceVisual :name="entry.name" :mark="entry.mark" :accent="entry.accent" :image-url="entry.imageUrl" />
          <article class="mt-8 space-y-10 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-10">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{{ entry.contentTitle }}</p>
              <p class="mt-4 text-lg leading-8 text-slate-600">{{ entry.summary }}</p>
            </div>
            <section v-for="section in entry.sections" :key="section.title">
              <h2 class="text-2xl font-black text-slate-950">{{ section.title }}</h2>
              <p v-for="paragraph in section.paragraphs" :key="paragraph" class="mt-4 leading-8 text-slate-600">{{ paragraph }}</p>
            </section>
            <section v-if="entry.kind === 'theme'">
              <h2 class="text-2xl font-black text-slate-950">{{ copy.themes.included }}</h2>
              <ul class="mt-5 grid gap-3 sm:grid-cols-2">
                <li v-for="item in copy.detail.themeSections" :key="item" class="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"><span class="text-blue-600">✓</span>{{ item }}</li>
              </ul>
            </section>
          </article>
        </div>

        <aside class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-blue-900/5 lg:sticky lg:top-28">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{{ category }}</p>
          <h1 class="mt-3 text-3xl font-black text-slate-950">{{ entry.name }}</h1>
          <p class="mt-4 leading-7 text-slate-600">{{ entry.summary }}</p>
          <dl class="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div v-if="entry.version" class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-400">{{ copy.common.version }}</dt><dd class="mt-1 font-black">{{ entry.version }}</dd></div>
            <div v-if="entry.publishedAt" class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-400">{{ copy.common.updated }}</dt><dd class="mt-1 font-black">{{ entry.publishedAt }}</dd></div>
          </dl>
          <div class="mt-6 rounded-2xl border px-4 py-3" :class="statusClass">
            <p class="text-xs font-black uppercase tracking-[0.16em]">{{ copy.package.label }}</p>
            <p class="mt-1 text-sm font-bold">{{ statusLabel }}</p>
            <code v-if="entry.artifactId" class="mt-2 block text-xs opacity-70">{{ entry.packageKind }}/{{ entry.artifactId }}</code>
          </div>
          <div class="mt-6 text-3xl font-black text-slate-950">{{ entry.price ? formatAmount(entry.price) : copy.common.free }}</div>

          <template v-if="entry.managementPath">
            <NuxtLink :to="entry.managementPath" class="mt-6 flex w-full justify-center rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">{{ copy.package.manage }}</NuxtLink>
          </template>
          <template v-else-if="entry.productSlug">
            <NuxtLink :to="localePath(`/products/${entry.productSlug}`)" class="mt-6 flex w-full justify-center rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">{{ entry.kind === 'theme' ? copy.themes.buy : copy.apps.buy }}</NuxtLink>
          </template>
          <template v-else>
            <button type="button" disabled class="mt-6 w-full cursor-not-allowed rounded-full bg-slate-200 px-6 py-3.5 font-black text-slate-500">{{ copy.package.unavailable }}</button>
          </template>
          <template v-if="entry.kind === 'theme'">
            <a v-if="entry.demoUrl" :href="entry.demoUrl" target="_blank" rel="noopener noreferrer" class="mt-3 flex w-full justify-center rounded-full border border-slate-200 px-6 py-3.5 font-black text-slate-700 hover:border-blue-300 hover:text-blue-600">{{ copy.themes.preview }}</a>
          </template>
        </aside>
      </section>
    </div>
  </main>
  <main v-else class="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-24 text-center">
    <h1 class="text-3xl font-black text-slate-950">404</h1>
    <p class="mt-4 text-slate-500">{{ copy.common.notFound }}</p>
    <NuxtLink :to="localePath(`/${kind}`)" class="mt-6 rounded-full bg-blue-600 px-6 py-3 font-black text-white">{{ copy.common.back }}</NuxtLink>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ShoplyMarketplaceCopy } from '../locales/marketplace'
import type { ShoplyMarketplaceEntry, ShoplyMarketplaceKind } from '../types/marketplace'
import { SEO_LOCALE_LANGUAGE } from '~~/shared/siteSeo'

const props = defineProps<{ kind: ShoplyMarketplaceKind, entry: ShoplyMarketplaceEntry | null, copy: ShoplyMarketplaceCopy, category: string }>()
const { localePath } = useLocaleRouter()
const { formatAmount } = useLocaleCurrency()
const route = useRoute()
const { locale } = useI18n()
const { currency, convertAmount } = useLocaleCurrency()
const statusLabel = computed(() => props.entry ? props.copy.package.status[props.entry.packageStatus] : '')
const statusClass = computed(() => {
  if (props.entry?.packageStatus === 'active' || props.entry?.packageStatus === 'enabled') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (props.entry?.packageStatus === 'ready') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
})

useJsonLd('shoply-marketplace-detail', computed(() => {
  const entry = props.entry
  if (!entry) return null
  const path = route.path
  const entity = entry.kind === 'app'
    ? {
        '@type': 'SoftwareApplication',
        '@id': `${path}#software`,
        name: entry.name,
        description: entry.summary,
        image: entry.imageUrl || undefined,
        applicationCategory: entry.category,
        softwareVersion: entry.version || undefined,
        inLanguage: SEO_LOCALE_LANGUAGE[locale.value as keyof typeof SEO_LOCALE_LANGUAGE] || locale.value,
        offers: entry.productSlug ? {
          '@type': 'Offer',
          url: path,
          price: convertAmount(entry.price),
          priceCurrency: currency.value,
        } : undefined,
      }
    : {
        '@type': 'Product',
        '@id': `${path}#theme`,
        name: entry.name,
        description: entry.summary,
        image: entry.imageUrl || undefined,
        inLanguage: SEO_LOCALE_LANGUAGE[locale.value as keyof typeof SEO_LOCALE_LANGUAGE] || locale.value,
        offers: entry.productSlug ? {
          '@type': 'Offer',
          url: path,
          price: convertAmount(entry.price),
          priceCurrency: currency.value,
        } : undefined,
      }
  return [entity, {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Shoply', item: '/' },
      { '@type': 'ListItem', position: 2, name: entry.name, item: path },
    ],
  }]
}))
</script>
