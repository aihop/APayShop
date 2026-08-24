<template>
  <div class="bg-white">
    <section class="relative isolate overflow-hidden bg-[#2678ff] px-5 py-20 text-white sm:px-8 sm:py-28">
      <div class="absolute inset-0 -z-10">
        <div class="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
        <div class="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-900/30 blur-3xl" />
      </div>
      <div class="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[1fr_0.86fr]">
        <div class="min-w-0">
          <p class="text-sm font-black tracking-[0.18em] text-amber-300 uppercase">{{ page.eyebrow }}</p>
          <h1 class="mt-5 max-w-4xl text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl">{{ page.title }}</h1>
          <p class="mt-6 max-w-2xl text-base leading-8 text-blue-50/85 sm:text-lg">{{ page.description }}</p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a :href="primaryUrl" class="rounded-full bg-white px-7 py-3.5 text-center text-sm font-extrabold text-blue-700 shadow-xl shadow-blue-950/15">{{ page.primary }}</a>
            <a :href="secondaryUrl" class="rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-center text-sm font-extrabold text-white">{{ page.secondary }}</a>
          </div>
        </div>
        <div class="relative mx-auto flex aspect-[4/3] w-full max-w-lg items-center justify-center rounded-[2.5rem] border border-white/25 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
          <div class="absolute inset-5 rounded-[2rem] border border-white/15" />
          <div class="relative flex h-44 w-44 items-center justify-center rounded-[2.5rem] bg-white text-blue-600 shadow-2xl sm:h-56 sm:w-56">
            <UIcon :name="page.icon" class="h-24 w-24 sm:h-32 sm:w-32" />
          </div>
          <span v-for="(item, index) in page.highlights.slice(0, 3)" :key="item" class="absolute rounded-full border border-white/25 bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur" :class="badgePositions[index]">{{ item }}</span>
        </div>
      </div>
    </section>

    <section v-if="page.highlights.length" class="border-b border-slate-200 bg-white px-5 py-8 sm:px-8">
      <div class="mx-auto grid max-w-[1280px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="item in page.highlights" :key="item" class="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">✓</span>
          {{ item }}
        </div>
      </div>
    </section>

    <section class="px-5 py-20 sm:px-8 sm:py-28">
      <div class="mx-auto max-w-[1280px]">
        <div class="mx-auto max-w-3xl text-center">
          <p class="text-sm font-black tracking-[0.18em] text-blue-600 uppercase">{{ page.sectionLabel }}</p>
          <h2 class="mt-4 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl">{{ page.sectionTitle }}</h2>
          <p class="mt-5 text-base leading-8 text-slate-600">{{ page.sectionDescription }}</p>
        </div>
        <div class="mt-12 grid gap-5" :class="page.sections.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'">
          <article v-for="(section, index) in page.sections" :key="section.title" class="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-blue-600">{{ index + 1 }}</span>
            <h3 class="mt-6 text-xl font-black tracking-tight text-slate-950">{{ section.title }}</h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">{{ section.description }}</p>
            <ul v-if="section.items?.length" class="mt-5 space-y-3 text-sm text-slate-600">
              <li v-for="item in section.items" :key="item" class="flex gap-2"><span class="text-blue-600">✓</span><span>{{ item }}</span></li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section v-if="page.note" class="bg-slate-50 px-5 py-16 sm:px-8">
      <div class="mx-auto flex max-w-4xl flex-col gap-5 rounded-[2rem] border border-blue-100 bg-white p-7 sm:flex-row sm:items-center sm:p-10">
        <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><UIcon name="ph:info-duotone" class="h-7 w-7" /></span>
        <p class="text-base leading-8 text-slate-700">{{ page.note }}</p>
      </div>
    </section>

    <PageCta
      :title="page.ctaTitle"
      :description="page.ctaDescription"
      :primary-label="page.primary"
      :secondary-label="page.secondary"
      :primary-url="primaryUrl"
      :secondary-url="secondaryUrl"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import en from '../locales/en'
import id from '../locales/id'
import ru from '../locales/ru'
import zh from '../locales/zh'
import zhHK from '../locales/zh-HK'

const props = defineProps<{ slug: keyof typeof en.pages.marketing }>()
const { locale } = useI18n()
const { getSetting } = useSettings()
const localeMessages = { en, zh, 'zh-HK': zhHK, id, ru }
const messages = computed(() => localeMessages[locale.value as keyof typeof localeMessages] || en)
const page = computed(() => {
  const content = messages.value.pages.marketing[props.slug]

  return {
    ...content,
    sections: content.sections.map(section => ({
      ...section,
      items: 'items' in section ? section.items : [],
    })),
  }
})
const primaryUrl = computed(() => getSetting('shoply_signup_url', 'https://account.shoply.cn/signup'))
const secondaryUrl = computed(() => getSetting('shoply_consult_url', 'mailto:support@shoply.cn'))
const badgePositions = ['left-3 top-8 sm:-left-4', 'right-2 top-20 sm:-right-5', 'bottom-8 left-8']

useSeoMeta({
  title: () => page.value.seoTitle,
  description: () => page.value.seoDescription,
  ogTitle: () => page.value.seoTitle,
  ogDescription: () => page.value.seoDescription,
})
</script>
