<template>
  <div class="bg-slate-50 px-5 py-16 sm:px-8 sm:py-24">
    <article class="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-12">
      <p class="text-sm font-black tracking-[0.18em] text-blue-600 uppercase">Shoply Legal</p>
      <h1 class="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ page.title }}</h1>
      <p class="mt-4 text-sm font-semibold text-slate-500">{{ page.updated }}</p>
      <p v-if="page.intro" class="mt-8 text-base leading-8 text-slate-700">{{ page.intro }}</p>
      <div class="mt-10 space-y-10">
        <section v-for="section in page.sections" :key="section.title">
          <h2 class="text-2xl font-black tracking-tight text-slate-950">{{ section.title }}</h2>
          <div class="mt-4 space-y-4">
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{{ paragraph }}</p>
          </div>
        </section>
      </div>
    </article>
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

const props = defineProps<{ slug: keyof typeof en.pages.legal }>()
const { locale } = useI18n()
const localeMessages = { en, zh, 'zh-HK': zhHK, id, ru }
const messages = computed(() => localeMessages[locale.value as keyof typeof localeMessages] || en)
const page = computed(() => messages.value.pages.legal[props.slug])

useSeoMeta({
  title: () => page.value.seoTitle,
  description: () => page.value.seoDescription,
  ogTitle: () => page.value.seoTitle,
  ogDescription: () => page.value.seoDescription,
})
</script>
