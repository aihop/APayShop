<template>
  <div class="min-h-screen overflow-x-hidden bg-white font-sans text-slate-900 selection:bg-blue-200">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <nav class="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:h-20 sm:px-8 lg:px-12">
        <NuxtLink
          :to="localePath('/')"
          class="shrink-0"
          :aria-label="$t('shoply.nav.home')"
          @click="isMobileMenuOpen = false"
        >
          <img
            :src="logoUrl"
            alt="Shoply"
            class="h-9 w-auto sm:h-10"
          />
        </NuxtLink>

        <div class="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex xl:gap-9">
          <a
            v-for="item in navigation"
            :key="item.id"
            :href="sectionHref(item.id)"
            class="transition-colors hover:text-blue-600"
          >{{ $t(item.label) }}</a>
          <NuxtLink
            v-for="item in marketplaceNavigation"
            :key="item.path"
            :to="localePath(item.path)"
            class="transition-colors hover:text-blue-600"
          >{{ item.label }}</NuxtLink>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <label class="relative hidden sm:block">
            <span class="sr-only">{{ $t('shoply.nav.language') }}</span>
            <select
              :value="locale"
              class="h-10 appearance-none rounded-full border-0 bg-slate-100 py-0 pl-4 pr-9 text-xs font-bold text-slate-700 outline-none ring-0"
              @change="switchLocale(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="item in locales" :key="item.code" :value="item.code">{{ item.name }}</option>
            </select>
            <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">⌄</span>
          </label>

          <a
            :href="signInUrl"
            class="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600 md:inline-flex"
          >{{ $t('shoply.nav.signIn') }}</a>
          <a
            :href="signUpUrl"
            class="hidden rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 md:inline-flex"
          >{{ $t('shoply.nav.signUp') }}</a>

          <button
            type="button"
            class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            :aria-label="$t(isMobileMenuOpen ? 'shoply.nav.closeMenu' : 'shoply.nav.menu')"
            :aria-expanded="isMobileMenuOpen"
            @click="isMobileMenuOpen = !isMobileMenuOpen"
          >
            <span class="sr-only">{{ $t(isMobileMenuOpen ? 'shoply.nav.closeMenu' : 'shoply.nav.menu') }}</span>
            <span
              class="absolute h-0.5 w-5 rounded-full bg-current transition-transform"
              :class="isMobileMenuOpen ? 'rotate-45' : '-translate-y-1.5'"
            />
            <span
              class="absolute h-0.5 w-5 rounded-full bg-current transition-opacity"
              :class="isMobileMenuOpen ? 'opacity-0' : 'opacity-100'"
            />
            <span
              class="absolute h-0.5 w-5 rounded-full bg-current transition-transform"
              :class="isMobileMenuOpen ? '-rotate-45' : 'translate-y-1.5'"
            />
          </button>
        </div>
      </nav>

      <div
        v-if="isMobileMenuOpen"
        class="border-t border-slate-200 bg-white px-5 py-5 shadow-xl lg:hidden"
      >
        <div class="mx-auto flex max-w-[1440px] flex-col gap-1">
          <a
            v-for="item in navigation"
            :key="item.id"
            :href="sectionHref(item.id)"
            class="rounded-xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            @click="isMobileMenuOpen = false"
          >{{ $t(item.label) }}</a>
          <NuxtLink
            v-for="item in marketplaceNavigation"
            :key="item.path"
            :to="localePath(item.path)"
            class="rounded-xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            @click="isMobileMenuOpen = false"
          >{{ item.label }}</NuxtLink>

          <div class="my-3 h-px bg-slate-200" />
          <div class="mb-4 grid grid-cols-2 gap-2 sm:hidden">
            <button
              v-for="item in locales"
              :key="item.code"
              type="button"
              class="flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold"
              :class="locale === item.code ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'"
              @click="switchLocale(item.code)"
            >
              {{ item.fullName }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <a
              :href="signInUrl"
              class="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700"
            >{{ $t('shoply.nav.signIn') }}</a>
            <a
              :href="signUpUrl"
              class="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white"
            >{{ $t('shoply.nav.signUp') }}</a>
          </div>
        </div>
      </div>
    </header>

    <main class="pt-[72px] sm:pt-20">
      <slot />
    </main>

    <footer class="bg-[#07152f] text-white">
      <div class="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-18 lg:px-12">
        <div class="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-5">
          <div class="lg:col-span-2">
            <img
              :src="inverseLogoUrl"
              alt="Shoply"
              class="h-10 w-auto"
            />
            <p class="mt-5 max-w-md text-sm leading-7 text-blue-100/70">
              {{ $t('shoply.footer.description') }}
            </p>
          </div>

          <div>
            <h2 class="text-sm font-bold text-white">{{ $t('shoply.footer.product') }}</h2>
            <ul class="mt-5 space-y-3 text-sm text-blue-100/70">
              <li><a :href="sectionHref('solutions')" class="hover:text-white">{{ $t('shoply.footer.solutions') }}</a></li>
              <li><a :href="sectionHref('ai')" class="hover:text-white">{{ $t('shoply.footer.ai') }}</a></li>
              <li><a :href="sectionHref('platform')" class="hover:text-white">{{ $t('shoply.footer.platform') }}</a></li>
              <li><NuxtLink :to="localePath('/apps')" class="hover:text-white">{{ marketplaceCopy.nav.apps }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/theme')" class="hover:text-white">{{ marketplaceCopy.nav.themes }}</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h2 class="text-sm font-bold text-white">{{ $t('shoply.footer.resources') }}</h2>
            <ul class="mt-5 space-y-3 text-sm text-blue-100/70">
              <li><a :href="openPlatformUrl" class="hover:text-white">{{ $t('shoply.footer.openPlatform') }}</a></li>
              <li><NuxtLink :to="localePath('/page/privacy')" class="hover:text-white">{{ $t('shoply.footer.privacy') }}</NuxtLink></li>
              <li><NuxtLink :to="localePath('/page/terms')" class="hover:text-white">{{ $t('shoply.footer.terms') }}</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h2 class="text-sm font-bold text-white">{{ $t('shoply.footer.company') }}</h2>
            <ul class="mt-5 space-y-3 text-sm text-blue-100/70">
              <li><a :href="localePath('/')" class="hover:text-white">{{ $t('shoply.footer.home') }}</a></li>
              <li><NuxtLink to="/admin" class="hover:text-white">{{ $t('shoply.footer.admin') }}</NuxtLink></li>
            </ul>
          </div>
        </div>

        <div class="flex flex-col gap-3 pt-7 text-xs leading-6 text-blue-100/55 lg:flex-row lg:items-center lg:justify-between">
          <p>Copyright © {{ currentYear }} {{ $t('shoply.footer.copyright') }}</p>
          <p>{{ $t('shoply.footer.operator') }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useLocaleRouter } from '~/composables/useLocaleRouter'
import en from '../locales/en'
import id from '../locales/id'
import ru from '../locales/ru'
import zh from '../locales/zh'
import zhHK from '../locales/zh-HK'
import { shoplyMarketplaceLocales, type ShoplyMarketplaceLocale } from '../locales/marketplace'
import logoUrl from '../assets/logo.svg?url'
import inverseLogoUrl from '../assets/logo-inverse.svg?url'

const { getSetting } = useSettings()
const { localePath } = useLocaleRouter()
const route = useRoute()
const { locale, mergeLocaleMessage, setLocale } = useI18n()

mergeLocaleMessage('en', { shoply: en })
mergeLocaleMessage('zh', { shoply: zh })
mergeLocaleMessage('zh-HK', { shoply: zhHK })
mergeLocaleMessage('id', { shoply: id })
mergeLocaleMessage('ru', { shoply: ru })

const isMobileMenuOpen = ref(false)
const currentYear = new Date().getFullYear()
const locales = [
  { code: 'en', name: 'EN', fullName: 'English' },
  { code: 'zh', name: '中文', fullName: '简体中文' },
  { code: 'zh-HK', name: '繁中', fullName: '香港繁體' },
  { code: 'id', name: 'ID', fullName: 'Bahasa Indonesia' },
  { code: 'ru', name: 'RU', fullName: 'Русский' },
]
const navigation = [
  { id: 'top', label: 'shoply.nav.home' },
  { id: 'solutions', label: 'shoply.nav.solutions' },
  { id: 'ai', label: 'shoply.nav.ai' },
  { id: 'platform', label: 'shoply.nav.platform' },
  { id: 'deployment', label: 'shoply.nav.deployment' },
]
const marketplaceCopy = computed(() => shoplyMarketplaceLocales[locale.value in shoplyMarketplaceLocales ? locale.value as ShoplyMarketplaceLocale : 'en'])
const marketplaceNavigation = computed(() => [
  { path: '/apps', label: marketplaceCopy.value.nav.apps },
  { path: '/theme', label: marketplaceCopy.value.nav.themes },
])

const signUpUrl = computed(() => getSetting('shoply_signup_url', 'https://account.shoply.cn/signup'))
const signInUrl = computed(() => getSetting('shoply_signin_url', 'https://account.shoply.cn/signin'))
const openPlatformUrl = computed(() => getSetting('shoply_open_platform_url', 'https://open.shoply.cn/'))

const sectionHref = (id: string) => `${localePath('/')}#${id}`

const supportedLocales = new Set(locales.map(item => item.code))

const switchLocale = async (newLocale: string) => {
  if (!supportedLocales.has(newLocale)) return
  isMobileMenuOpen.value = false
  await setLocale(newLocale as 'en' | 'zh' | 'zh-HK' | 'id' | 'ru')
}

useHead({
  htmlAttrs: {
    class: 'scroll-smooth',
    lang: computed(() => locale.value),
  },
  titleTemplate: (titleChunk) => titleChunk || 'Shoply',
})
</script>
