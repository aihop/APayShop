<template>
  <div class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
        <UIcon
          name="ph:magnifying-glass-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">Search Engine Optimization (SEO)</h2>
    </div>

    <!-- Language Tabs -->
    <div class="px-6 pt-4 border-b border-gray-800/60 bg-[#121214]">
      <nav class="flex space-x-2 overflow-x-auto hide-scrollbar pb-2">
        <button
          v-for="locale in supportedLocales"
          :key="locale.code"
          type="button"
          @click="activeLocale = locale.code"
          :class="[
            'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            activeLocale === locale.code
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
          ]"
        >
          <UIcon
            :name="locale.code === defaultLocale ? 'ph:star-fill' : 'ph:translate'"
            :class="[
              'w-4 h-4',
              locale.code === defaultLocale ? 'text-yellow-500' : ''
            ]"
          />
          {{ locale.name }} ({{ locale.code }})
        </button>
      </nav>
    </div>

    <div class="p-6 space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-1 gap-6">
        <UFormField
          label="Site Title (SEO)"
          :description="`Global meta title for search engines (${activeLocale})`"
        >
          <UInput
            v-model="form[getTitleKey(activeLocale)]"
            placeholder="APayShop - Premium Digital Goods"
            icon="ph:browser"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-[#09090b]' }"
          />
        </UFormField>

        <UFormField
          label="Site Description (SEO)"
          :description="`Global meta description for search engines (${activeLocale})`"
        >
          <UTextarea
            v-model="form[getDescriptionKey(activeLocale)]"
            placeholder="The best place to buy digital goods securely."
            icon="ph:text-align-left"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-[#09090b]' }"
          />
        </UFormField>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  form: any
}>()

// All possible locales in the system
const allLocales = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
]

// Computed property to get supported locales based on form data
const supportedLocales = computed(() => {
  if (!props.form.supported_locales) return [allLocales[0]]

  const codes = props.form.supported_locales
    .split(',')
    .map((l: string) => l.trim())
    .filter(Boolean)
  return codes.map((code: string) => {
    const locale = allLocales.find((l) => l.code === code)
    return locale || { code, name: code.toUpperCase() }
  })
})

const defaultLocale = computed(() => props.form.default_locale || 'en')
const activeLocale = ref(defaultLocale.value)

// Update active locale if default locale changes and current active is not in supported list
watch(
  supportedLocales,
  (newLocales) => {
    if (!newLocales.find((l: any) => l.code === activeLocale.value)) {
      activeLocale.value = defaultLocale.value
    }
  },
  { deep: true }
)

// Helper functions to generate dynamic keys based on user requirement: "zh_site_title"
const getTitleKey = (localeCode: string) => {
  return localeCode === 'en'
    ? 'site_title'
    : `${localeCode.replace('-', '_')}_site_title`
}

const getDescriptionKey = (localeCode: string) => {
  return localeCode === 'en'
    ? 'site_description'
    : `${localeCode.replace('-', '_')}_site_description`
}

// Initialize dynamic fields in form object if they don't exist
watch(
  supportedLocales,
  (locales) => {
    locales.forEach((locale: any) => {
      const titleKey = getTitleKey(locale.code)
      const descKey = getDescriptionKey(locale.code)

      if (!(titleKey in props.form)) {
        props.form[titleKey] = ''
      }
      if (!(descKey in props.form)) {
        props.form[descKey] = ''
      }
    })
  },
  { immediate: true, deep: true }
)
</script>