<template>
  <div class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
        <UIcon
          name="ph:translate-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">Localization & Currency</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UFormField
          label="Default Locale"
          description="The primary language for your storefront"
        >
          <USelectMenu
            v-model="form.default_locale"
            :items="selectedLocaleOptions"
            value-key="code"
            placeholder="Select default language"
            icon="ph:flag"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-[#09090b]' }"
          >

          </USelectMenu>
        </UFormField>

        <UFormField
          label="Settlement Currency"
          description="The primary currency for pricing and transactions"
        >
          <USelectMenu
            v-model="form.currency"
            :items="availableCurrencies"
            value-key="code"
            placeholder="Select or type currency"
            icon="ph:currency-circle-dollar"
            size="md"
            class="w-full"
            create-item
            :search-input="{ placeholder: 'Search or type currency...' }"
            :ui="{ base: 'bg-[#09090b]' }"
          >
          </USelectMenu>
        </UFormField>
      </div>

      <USeparator
        label="Supported Languages"
        class="py-4"
      />

      <UFormField description="Select all languages you want to support. Users can switch between these on the storefront.">
        <div class="locales-grid-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
          <div
            v-for="locale in availableLocales"
            :key="locale.code"
            class="flex items-center gap-2 p-3 rounded-xl border border-gray-800/60 bg-[#09090b] hover:border-gray-700 transition-colors cursor-pointer group"
            @click="toggleLocale(locale.code, !isLocaleSelected(locale.code))"
          >
            <UIcon
              name="ph:dots-six-vertical"
              class="w-5 h-5 text-gray-600 hover:text-gray-400 cursor-move drag-handle flex-shrink-0"
              @click.stop
            />
            <UCheckbox
              :model-value="isLocaleSelected(locale.code)"
              @update:model-value="(checked) => toggleLocale(locale.code, checked)"
              @click.stop
              :ui="{ base: 'bg-[#121214]' }"
            />
            <div class="flex flex-col overflow-hidden">
              <span class="text-sm font-medium text-gray-200 truncate">{{ locale.label }}</span>
              <span class="text-xs text-gray-500 uppercase">{{ locale.code }}</span>
            </div>
          </div>
        </div>
      </UFormField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'

const props = defineProps<{
  form: any
}>()

const baseLocales = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' }, // Hindi
]

const availableLocales = ref([...baseLocales])

const selectedLocales = computed(() => {
  if (!props.form.supported_locales) return []
  return props.form.supported_locales
    .split(',')
    .map((l: string) => l.trim())
    .filter(Boolean)
})

const selectedLocaleOptions = computed(() => {
  return availableLocales.value.filter((l) =>
    selectedLocales.value.includes(l.code)
  )
})

const isLocaleSelected = (code: string) => {
  return selectedLocales.value.includes(code)
}

const toggleLocale = (code: string, checked: boolean) => {
  let current = [...selectedLocales.value]
  if (checked && !current.includes(code)) {
    current.push(code)
  } else if (!checked && current.includes(code)) {
    current = current.filter((c) => c !== code)
  }

  // Ensure at least the default locale is selected
  const defaultLocale = props.form.default_locale || 'en'
  if (
    current.length === 0 ||
    (!current.includes(defaultLocale) && code === defaultLocale && !checked)
  ) {
    if (!current.includes(defaultLocale)) {
      current.push(defaultLocale)
    }
  }

  // Preserve the visual order of availableLocales
  const visualOrderSelected = availableLocales.value
    .filter((l) => current.includes(l.code))
    .map((l) => l.code)

  props.form.supported_locales = visualOrderSelected.join(',')
}

let hasInitializedOrder = false
watch(
  () => props.form.supported_locales,
  (newVal) => {
    if (newVal && !hasInitializedOrder) {
      const selected = newVal
        .split(',')
        .map((l: string) => l.trim())
        .filter(Boolean)
      if (selected.length > 0) {
        const sorted: typeof baseLocales = []
        const unselected = [...baseLocales]
        selected.forEach((code: string) => {
          const idx = unselected.findIndex((l) => l.code === code)
          if (idx !== -1) {
            const item = unselected[idx]
            if (item) sorted.push(item)
            unselected.splice(idx, 1)
          }
        })
        availableLocales.value = [...sorted, ...unselected]
      }
      hasInitializedOrder = true
    }
  },
  { immediate: true }
)

// @ts-ignore
useSortable('.locales-grid-container', availableLocales, {
  animation: 150,
  handle: '.drag-handle',
  onUpdate: () => {
    const newSelectedOrder = availableLocales.value
      .filter((l) => isLocaleSelected(l.code))
      .map((l) => l.code)
    props.form.supported_locales = newSelectedOrder.join(',')
  },
})

const availableCurrencies = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'CNY', label: 'Chinese Yuan (¥)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'HKD', label: 'Hong Kong Dollar (HK$)' },
]
</script>