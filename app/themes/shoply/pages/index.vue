<template>
  <div id="top" class="bg-white">
    <section class="relative isolate overflow-hidden bg-[#2678ff] text-white">
      <div class="absolute inset-0 -z-10">
        <div class="absolute -left-28 top-18 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
        <div class="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-indigo-800/30 blur-3xl" />
        <div class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-blue-800/25 to-transparent" />
      </div>

      <div class="mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-12 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-28">
        <div class="relative z-10 min-w-0 max-w-2xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold tracking-[0.12em] text-blue-50 uppercase backdrop-blur-sm">
            <span class="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(253,224,71,0.9)]" />
            {{ $t('shoply.hero.eyebrow') }}
          </div>

          <h1 class="mt-7 text-4xl font-black leading-[1.06] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            {{ $t('shoply.hero.titleBefore') }}
            <span class="mt-2 block text-amber-300">{{ $t('shoply.hero.titleAccent') }}</span>
          </h1>
          <p class="mt-7 max-w-xl text-base leading-8 text-blue-50/85 sm:text-lg">
            {{ $t('shoply.hero.description') }}
          </p>

          <div class="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              :href="signUpUrl"
              class="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-extrabold text-blue-600 shadow-xl shadow-blue-950/15 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
            >
              {{ $t('shoply.hero.primary') }}
              <UIcon name="ph:arrow-right-bold" class="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#solutions"
              class="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >{{ $t('shoply.hero.secondary') }}</a>
          </div>

          <div class="mt-8 flex items-center gap-3 text-sm font-semibold text-blue-100">
            <span class="flex -space-x-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-cyan-300 text-[10px] font-black text-blue-900">B2C</span>
              <span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-amber-300 text-[10px] font-black text-blue-900">B2B</span>
              <span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-[10px] font-black text-blue-700">AI</span>
            </span>
            {{ $t('shoply.hero.proof') }}
          </div>
        </div>

        <div class="relative mx-auto min-w-0 w-full max-w-[680px] lg:mx-0 lg:justify-self-end">
          <div class="absolute -inset-8 rounded-[3rem] bg-white/10 blur-2xl" />
          <div class="relative overflow-hidden rounded-[1.75rem] border border-white/30 bg-white p-3 shadow-[0_35px_90px_rgba(13,45,120,0.35)] sm:p-4">
            <div class="flex items-center gap-2 rounded-t-[1.1rem] bg-slate-100 px-4 py-3">
              <span class="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span class="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div class="ml-2 flex-1 rounded-full bg-white px-4 py-1.5 text-center text-[10px] font-semibold text-slate-400 sm:text-xs">
                {{ $t('shoply.hero.visualUrl') }}
              </div>
            </div>

            <div class="relative min-h-[360px] overflow-hidden rounded-b-[1.1rem] bg-[#f8f4ef] p-5 sm:min-h-[430px] sm:p-8">
              <div class="absolute right-4 top-4 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-bold text-emerald-600 shadow-sm backdrop-blur-sm">
                ● {{ $t('shoply.hero.visualBadge') }}
              </div>
              <div class="max-w-[54%] pt-10 sm:pt-14">
                <p class="text-[10px] font-bold tracking-[0.18em] text-orange-500 uppercase">Shoply / 2026</p>
                <p class="mt-3 text-2xl font-black leading-tight text-slate-900 sm:text-4xl">{{ $t('shoply.hero.visualTitle') }}</p>
                <p class="mt-3 text-xs leading-5 text-slate-500 sm:text-sm">{{ $t('shoply.hero.visualSubtitle') }}</p>
                <span class="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-[10px] font-bold text-white sm:text-xs">{{ $t('shoply.hero.visualButton') }}</span>
              </div>

              <div class="absolute -bottom-8 -right-10 h-[82%] w-[58%] rotate-[-6deg] rounded-t-[48%] bg-gradient-to-br from-amber-100 via-orange-200 to-rose-300 shadow-2xl">
                <div class="absolute left-[16%] top-[12%] h-[76%] w-[68%] rounded-[45%_45%_20%_20%] border-[12px] border-white/45 bg-gradient-to-b from-rose-100 to-amber-50 shadow-inner sm:border-[18px]" />
              </div>
              <div class="absolute bottom-6 right-[36%] rounded-2xl border border-white/80 bg-white/85 p-3 shadow-xl backdrop-blur sm:p-4">
                <p class="text-[9px] font-bold text-slate-400 uppercase">{{ $t('shoply.hero.visualProduct') }}</p>
                <p class="mt-1 text-sm font-black text-blue-600 sm:text-lg">+{{ $t('shoply.hero.visualDiscount') }}</p>
              </div>
            </div>
          </div>

          <div class="absolute -bottom-5 -left-2 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/90 px-4 py-3 text-slate-900 shadow-xl backdrop-blur sm:-left-8">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <UIcon name="ph:chart-line-up-bold" class="h-5 w-5" />
            </span>
            <div>
              <p class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Conversion</p>
              <p class="text-sm font-black text-slate-900">+38.6%</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="solutions" class="scroll-mt-20 bg-slate-50 py-20 sm:py-28">
      <div class="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <SectionHeading
          :label="$t('shoply.values.label')"
          :title="$t('shoply.values.title')"
          :description="$t('shoply.values.description')"
        />
        <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="item in valueItems"
            :key="item.title"
            class="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
          >
            <span class="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <UIcon :name="item.icon" class="h-7 w-7" />
            </span>
            <h3 class="mt-6 text-xl font-extrabold tracking-tight text-slate-900">{{ item.title }}</h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">{{ item.description }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="py-20 sm:py-28">
      <div class="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <SectionHeading
          :label="$t('shoply.audiences.label')"
          :title="$t('shoply.audiences.title')"
          :description="$t('shoply.audiences.description')"
        />
        <div class="mt-12 grid gap-5 lg:grid-cols-2">
          <article
            v-for="(item, index) in audienceItems"
            :key="item.title"
            class="relative overflow-hidden rounded-[2rem] border border-slate-200 p-7 sm:p-9"
            :class="index === 0 ? 'bg-blue-600 text-white' : 'bg-white text-slate-900'"
          >
            <div class="relative z-10 flex items-start gap-5">
              <span
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                :class="index === 0 ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'"
              >
                <UIcon :name="item.icon" class="h-7 w-7" />
              </span>
              <div>
                <h3 class="text-2xl font-black tracking-tight">{{ item.title }}</h3>
                <p class="mt-3 max-w-xl text-sm leading-7" :class="index === 0 ? 'text-blue-100' : 'text-slate-600'">{{ item.description }}</p>
                <div class="mt-5 flex flex-wrap gap-2">
                  <span
                    v-for="tag in item.tags"
                    :key="tag"
                    class="rounded-full px-3 py-1.5 text-xs font-bold"
                    :class="index === 0 ? 'bg-white/12 text-white' : 'bg-slate-100 text-slate-600'"
                  >{{ tag }}</span>
                </div>
              </div>
            </div>
            <UIcon
              :name="item.icon"
              class="absolute -bottom-12 -right-8 h-44 w-44 opacity-[0.04]"
            />
          </article>
        </div>
      </div>
    </section>

    <section id="ai" class="scroll-mt-20 overflow-hidden bg-[#07152f] py-20 text-white sm:py-28">
      <div class="mx-auto grid max-w-[1440px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12">
        <div>
          <div class="flex items-center gap-3">
            <img :src="aiMarkUrl" alt="" class="h-10 w-11" />
            <p class="text-sm font-black tracking-[0.18em] text-cyan-300 uppercase">{{ $t('shoply.ai.label') }}</p>
          </div>
          <h2 class="mt-6 max-w-xl text-4xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">{{ $t('shoply.ai.title') }}</h2>
          <p class="mt-6 max-w-xl text-base leading-8 text-blue-100/70">{{ $t('shoply.ai.description') }}</p>
          <a
            :href="consultUrl"
            class="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-blue-700 transition-transform hover:-translate-y-0.5"
          >
            {{ $t('shoply.ai.action') }}
            <UIcon name="ph:arrow-up-right-bold" class="h-4 w-4" />
          </a>
        </div>

        <div class="relative">
          <img :src="ribbonsUrl" alt="" class="absolute -top-8 right-4 h-7 w-44" />
          <div class="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:p-6">
            <div class="rounded-2xl bg-white p-5 text-slate-900 sm:p-7">
              <div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p class="text-base font-black sm:text-lg">{{ $t('shoply.ai.panelTitle') }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ $t('shoply.ai.panelHint') }}</p>
                </div>
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white">
                  <UIcon name="ph:sparkle-fill" class="h-5 w-5" />
                </span>
              </div>

              <div class="mt-5 space-y-3">
                <div
                  v-for="(item, index) in aiItems"
                  :key="item.title"
                  class="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-blue-600 shadow-sm">{{ index + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-extrabold text-slate-900">{{ item.title }}</p>
                    <p class="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">{{ item.description }}</p>
                  </div>
                  <UIcon :name="item.icon" class="h-5 w-5 shrink-0 text-blue-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="platform" class="scroll-mt-20 py-20 sm:py-28">
      <div class="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <SectionHeading
          :label="$t('shoply.platform.label')"
          :title="$t('shoply.platform.title')"
          :description="$t('shoply.platform.description')"
        />
        <div class="mt-12 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="item in platformItems"
            :key="item.title"
            class="flex gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <UIcon :name="item.icon" class="h-6 w-6" />
            </span>
            <div>
              <h3 class="text-base font-extrabold text-slate-900">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="bg-slate-50 py-20 sm:py-28">
      <div class="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div class="grid items-end gap-8 lg:grid-cols-2">
          <SectionHeading
            :label="$t('shoply.ecosystem.label')"
            :title="$t('shoply.ecosystem.title')"
            :description="$t('shoply.ecosystem.description')"
            align="left"
          />
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="(item, index) in ecosystemItems"
              :key="item"
              class="flex min-h-20 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-center text-sm font-black text-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:text-blue-600"
            >
              <span class="mr-2 flex h-7 w-7 items-center justify-center rounded-lg text-xs text-white" :class="ecosystemColors[index]">{{ item.slice(0, 1) }}</span>
              {{ item }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="deployment" class="scroll-mt-20 py-20 sm:py-28">
      <div class="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <SectionHeading
          :label="$t('shoply.deployment.label')"
          :title="$t('shoply.deployment.title')"
          :description="$t('shoply.deployment.description')"
        />
        <div class="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-2">
          <article
            v-for="(item, index) in deploymentItems"
            :key="item.title"
            class="relative overflow-hidden rounded-[2rem] border p-8 sm:p-10"
            :class="index === 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-950 text-white'"
          >
            <div class="flex items-start justify-between gap-4">
              <span
                class="flex h-14 w-14 items-center justify-center rounded-2xl"
                :class="index === 0 ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/10 text-cyan-300'"
              >
                <UIcon :name="item.icon" class="h-7 w-7" />
              </span>
              <span
                class="rounded-full px-3 py-1.5 text-xs font-extrabold"
                :class="index === 0 ? 'bg-blue-600 text-white' : 'bg-cyan-300/15 text-cyan-300'"
              >{{ item.badge }}</span>
            </div>
            <h3 class="mt-8 text-3xl font-black tracking-tight">{{ item.title }}</h3>
            <p class="mt-4 min-h-[84px] text-sm leading-7" :class="index === 0 ? 'text-slate-600' : 'text-slate-300'">{{ item.description }}</p>
            <a
              :href="index === 0 ? signUpUrl : consultUrl"
              class="mt-7 inline-flex items-center gap-2 text-sm font-extrabold"
              :class="index === 0 ? 'text-blue-600' : 'text-cyan-300'"
            >
              {{ item.action }}
              <UIcon name="ph:arrow-right-bold" class="h-4 w-4" />
            </a>
          </article>
        </div>
      </div>
    </section>

    <section class="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
      <div class="relative mx-auto max-w-[1344px] overflow-hidden rounded-[2rem] bg-[#2678ff] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div class="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div class="absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-indigo-900/30 blur-3xl" />
        <div class="relative">
          <p class="text-xs font-black tracking-[0.18em] text-amber-300 uppercase">{{ $t('shoply.cta.eyebrow') }}</p>
          <h2 class="mx-auto mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">{{ $t('shoply.cta.title') }}</h2>
          <p class="mx-auto mt-5 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">{{ $t('shoply.cta.description') }}</p>
          <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a :href="signUpUrl" class="rounded-full bg-white px-7 py-3.5 text-sm font-extrabold text-blue-600 shadow-xl">{{ $t('shoply.cta.primary') }}</a>
            <a :href="consultUrl" class="rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-extrabold text-white backdrop-blur">{{ $t('shoply.cta.secondary') }}</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import aiMarkUrl from '../assets/ai-mark.svg?url'
import ribbonsUrl from '../assets/ribbons.svg?url'
import en from '../locales/en'
import id from '../locales/id'
import ru from '../locales/ru'
import zh from '../locales/zh'
import zhHK from '../locales/zh-HK'

interface ContentItem {
  icon: string
  title: string
  description: string
  tags?: string[]
  badge?: string
  action?: string
}

const { t, locale, mergeLocaleMessage } = useI18n()
const { getSetting } = useSettings()

mergeLocaleMessage('en', { shoply: en })
mergeLocaleMessage('zh', { shoply: zh })
mergeLocaleMessage('zh-HK', { shoply: zhHK })
mergeLocaleMessage('id', { shoply: id })
mergeLocaleMessage('ru', { shoply: ru })

const localeMessages = { en, zh, 'zh-HK': zhHK, id, ru }
const messages = computed(() => localeMessages[locale.value as keyof typeof localeMessages] || en)
const valueItems = computed<ContentItem[]>(() => messages.value.values.items)
const audienceItems = computed<ContentItem[]>(() => messages.value.audiences.items)
const aiItems = computed<ContentItem[]>(() => messages.value.ai.items)
const platformItems = computed<ContentItem[]>(() => messages.value.platform.items)
const deploymentItems = computed<ContentItem[]>(() => messages.value.deployment.items)
const ecosystemItems = computed(() => messages.value.ecosystem.items)
const ecosystemColors = ['bg-blue-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-orange-500', 'bg-rose-500', 'bg-blue-500', 'bg-green-600', 'bg-slate-800']

const signUpUrl = computed(() => getSetting('shoply_signup_url', 'https://account.shoply.cn/signup'))
const consultUrl = computed(() => getSetting('shoply_consult_url', 'mailto:support@shoply.cn'))

useSeoMeta({
  title: () => t('shoply.seo.title'),
  description: () => t('shoply.seo.description'),
  ogTitle: () => t('shoply.seo.title'),
  ogDescription: () => t('shoply.seo.description'),
  ogType: 'website',
})
</script>
