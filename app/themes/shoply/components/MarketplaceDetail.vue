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
          <div class="mt-6 text-3xl font-black text-slate-950">{{ entry.price ? formatAmount(entry.price) : copy.common.free }}</div>

          <template v-if="entry.kind === 'app'">
            <button type="button" class="mt-6 w-full rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700" @click="installOpen = true">{{ copy.apps.install }}</button>
          </template>
          <template v-else>
            <NuxtLink v-if="entry.productSlug" :to="localePath(`/products/${entry.productSlug}`)" class="mt-6 flex w-full justify-center rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">{{ copy.themes.buy }}</NuxtLink>
            <a v-else :href="consultUrl" class="mt-6 flex w-full justify-center rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">{{ copy.themes.consult }}</a>
            <a v-if="entry.demoUrl" :href="entry.demoUrl" target="_blank" rel="noopener noreferrer" class="mt-3 flex w-full justify-center rounded-full border border-slate-200 px-6 py-3.5 font-black text-slate-700 hover:border-blue-300 hover:text-blue-600">{{ copy.themes.preview }}</a>
          </template>
        </aside>
      </section>
    </div>

    <div v-if="installOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-5" role="dialog" aria-modal="true" :aria-label="copy.apps.installTitle" @click.self="installOpen = false">
      <div class="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
        <div class="flex items-start justify-between gap-6">
          <div><p class="text-xs font-black uppercase tracking-[0.18em] text-blue-600">SHOPLY ADMIN</p><h2 class="mt-2 text-2xl font-black">{{ copy.apps.installTitle }}</h2></div>
          <button type="button" class="rounded-full bg-slate-100 px-3 py-2 text-sm font-black" @click="installOpen = false">{{ copy.common.close }}</button>
        </div>
        <p class="mt-5 leading-7 text-slate-600">{{ copy.apps.installDescription }}</p>
        <p class="mt-6 text-sm font-bold text-slate-500">{{ copy.apps.commandHint }}</p>
        <div class="mt-3 flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-white">
          <code class="min-w-0 flex-1 overflow-x-auto text-sm">{{ installCommand }}</code>
          <button type="button" class="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black" @click="copyCommand">{{ copied ? copy.common.copied : copy.common.copy }}</button>
        </div>
        <a :href="signInUrl" class="mt-6 flex w-full justify-center rounded-full bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">{{ copy.apps.signIn }}</a>
      </div>
    </div>
  </main>
  <main v-else class="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-24 text-center">
    <h1 class="text-3xl font-black text-slate-950">404</h1>
    <p class="mt-4 text-slate-500">{{ copy.common.notFound }}</p>
    <NuxtLink :to="localePath(`/${kind}`)" class="mt-6 rounded-full bg-blue-600 px-6 py-3 font-black text-white">{{ copy.common.back }}</NuxtLink>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ShoplyMarketplaceCopy } from '../locales/marketplace'
import type { ShoplyMarketplaceEntry, ShoplyMarketplaceKind } from '../types/marketplace'

const props = defineProps<{ kind: ShoplyMarketplaceKind, entry: ShoplyMarketplaceEntry | null, copy: ShoplyMarketplaceCopy, category: string }>()
const { localePath } = useLocaleRouter()
const { formatAmount } = useLocaleCurrency()
const { getSetting } = useSettings()
const installOpen = ref(false)
const copied = ref(false)
const installCommand = `shoply://app/${props.entry?.slug || ''}`
const signInUrl = getSetting('shoply_signin_url', 'https://account.shoply.cn/signin')
const consultUrl = getSetting('shoply_consult_url', 'mailto:support@shoply.cn')

const copyCommand = async () => {
  if (!navigator.clipboard) return
  await navigator.clipboard.writeText(installCommand)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1800)
}
</script>
