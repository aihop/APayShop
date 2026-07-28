<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
        <UIcon
          name="ph:translate-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.localization.title') }}</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UFormField
          :label="$t('admin.settings.localization.default_locale')"
          :description="$t('admin.settings.localization.default_locale_desc')"
        >
          <USelectMenu
            v-model="form.default_locale"
            :items="selectedLocaleOptions"
            value-key="code"
            placeholder="Select default language"
            icon="ph:flag"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          >

          </USelectMenu>
        </UFormField>

        <UFormField
          :label="$t('admin.settings.localization.settlement_currency')"
          :description="$t('admin.settings.localization.settlement_currency_desc')"
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
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          >
          </USelectMenu>
        </UFormField>
      </div>

      <!-- Timezone -->
      <UFormField
        :label="$t('admin.settings.localization.timezone')"
        :description="$t('admin.settings.localization.timezone_desc')"
      >
        <USelectMenu
          v-model="form.timezone"
          :items="timezoneOptions"
          value-key="value"
          placeholder="Select timezone"
          icon="ph:clock"
          size="md"
          class="w-full max-w-lg"
          :search-input="{ placeholder: 'Search timezone...' }"
          create-item
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        >
          <template #item-leading="{ item }">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono w-16 shrink-0">{{ item.offset }}</span>
          </template>
        </USelectMenu>
      </UFormField>

      <USeparator
        :label="$t('admin.settings.localization.supported_languages')"
        class="py-4"
      />

      <UFormField :description="$t('admin.settings.localization.supported_languages_desc')">
        <div class="locales-grid-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
          <div
            v-for="locale in availableLocales"
            :key="locale.code"
            class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#09090b] hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer group"
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
              :ui="{ base: 'bg-white dark:bg-[#121214]' }"
            />
            <div class="flex flex-col overflow-hidden">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{{ locale.label }}</span>
              <span class="text-xs text-gray-500 uppercase">{{ locale.code }}</span>
            </div>
          </div>
        </div>
      </UFormField>

      <USeparator
        :label="$t('admin.settings.localization.locale_currency_bindings')"
        class="py-4"
      />

      <div class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.settings.localization.locale_currency_bindings_desc', { currency: baseCurrency }) }}
        </p>
        <div
          v-for="locale in selectedLocaleOptions"
          :key="locale.code"
          class="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800/60 dark:bg-[#09090b] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-end"
        >
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ locale.label }}</div>
            <div class="text-xs uppercase text-gray-500">{{ locale.code }}</div>
          </div>
          <UCheckbox
            :model-value="hasLocaleBinding(locale.code)"
            :label="$t('admin.settings.localization.custom_binding')"
            class="pb-2"
            @update:model-value="value => toggleLocaleBinding(locale.code, Boolean(value))"
          />
          <UFormField :label="$t('admin.settings.localization.binding_currency')">
            <USelectMenu
              :model-value="getLocaleBinding(locale.code).currency"
              :items="availableCurrencies"
              value-key="code"
              create-item
              :disabled="!hasLocaleBinding(locale.code)"
              class="w-full"
              @update:model-value="value => updateLocaleBinding(locale.code, 'currency', value)"
            />
          </UFormField>
          <UFormField :label="$t('admin.settings.localization.exchange_rate')">
            <UInput
              :model-value="getLocaleBinding(locale.code).rate"
              type="number"
              min="0.000001"
              step="any"
              :disabled="!hasLocaleBinding(locale.code) || getLocaleBinding(locale.code).currency === baseCurrency"
              class="w-full"
              @update:model-value="value => updateLocaleBinding(locale.code, 'rate', value)"
            />
          </UFormField>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'

const { t } = useI18n()

const props = defineProps<{
  form: any
}>()

// Auto-detect browser timezone as default
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
watch(() => props.form.timezone, (val) => {
  if (!val) {
    props.form.timezone = detectedTimezone
  }
}, { immediate: true })

// ---- Locales ----

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
  { code: 'hi', label: 'हिन्दी' },
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

  const defaultLocale = props.form.default_locale || 'en'
  if (
    current.length === 0 ||
    (!current.includes(defaultLocale) && code === defaultLocale && !checked)
  ) {
    if (!current.includes(defaultLocale)) {
      current.push(defaultLocale)
    }
  }

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

// ---- Currencies ----

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
  { code: 'RUB', label: 'Russian Ruble (₽)' },
]

interface CurrencyBinding {
  currency: string
  rate: number
}

const parseBindings = (): Record<string, CurrencyBinding> => {
  try {
    const parsed = JSON.parse(props.form.locale_currency_bindings || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const baseCurrency = computed(() => String(props.form.currency || 'USD').trim().toUpperCase() || 'USD')

const hasLocaleBinding = (locale: string) => Boolean(parseBindings()[locale])

const getLocaleBinding = (locale: string): CurrencyBinding => {
  const binding = parseBindings()[locale]
  const currency = String(binding?.currency || baseCurrency.value).trim().toUpperCase()
  const rate = currency === baseCurrency.value ? 1 : Number(binding?.rate || 1)
  return { currency, rate: Number.isFinite(rate) && rate > 0 ? rate : 1 }
}

const updateLocaleBinding = (locale: string, field: keyof CurrencyBinding, value: unknown) => {
  const bindings = parseBindings()
  const current = getLocaleBinding(locale)
  if (field === 'currency') {
    current.currency = String(value || baseCurrency.value).trim().toUpperCase()
    if (current.currency === baseCurrency.value) current.rate = 1
  } else {
    const rate = Number(value)
    current.rate = Number.isFinite(rate) && rate > 0 ? rate : 1
  }
  bindings[locale] = current
  props.form.locale_currency_bindings = JSON.stringify(bindings)
}

const toggleLocaleBinding = (locale: string, enabled: boolean) => {
  const bindings = parseBindings()
  if (enabled) {
    bindings[locale] = { currency: baseCurrency.value, rate: 1 }
  } else {
    delete bindings[locale]
  }
  props.form.locale_currency_bindings = JSON.stringify(bindings)
}

watch([selectedLocales, baseCurrency], ([locales]) => {
  const bindings = parseBindings()
  const next: Record<string, CurrencyBinding> = {}
  for (const locale of locales) {
    const binding = bindings[locale]
    if (!binding) continue
    const currency = String(binding.currency || baseCurrency.value).trim().toUpperCase()
    const rate = currency === baseCurrency.value ? 1 : Number(binding?.rate || 1)
    next[locale] = {
      currency,
      rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    }
  }
  props.form.locale_currency_bindings = JSON.stringify(next)
}, { immediate: true })

// ---- Timezones ----

interface TimezoneItem {
  value: string
  labelKey: string
  offset: string
}

const tzData: TimezoneItem[] = [
  { value: 'UTC', labelKey: 'admin.settings.localization.timezone_zones.UTC', offset: 'UTC' },
  { value: 'America/New_York', labelKey: 'admin.settings.localization.timezone_zones.America_New_York', offset: '-05:00' },
  { value: 'America/Chicago', labelKey: 'admin.settings.localization.timezone_zones.America_Chicago', offset: '-06:00' },
  { value: 'America/Denver', labelKey: 'admin.settings.localization.timezone_zones.America_Denver', offset: '-07:00' },
  { value: 'America/Los_Angeles', labelKey: 'admin.settings.localization.timezone_zones.America_Los_Angeles', offset: '-08:00' },
  { value: 'America/Anchorage', labelKey: 'admin.settings.localization.timezone_zones.America_Anchorage', offset: '-09:00' },
  { value: 'America/Phoenix', labelKey: 'admin.settings.localization.timezone_zones.America_Phoenix', offset: '-07:00' },
  { value: 'America/Toronto', labelKey: 'admin.settings.localization.timezone_zones.America_Toronto', offset: '-05:00' },
  { value: 'America/Vancouver', labelKey: 'admin.settings.localization.timezone_zones.America_Vancouver', offset: '-08:00' },
  { value: 'America/Sao_Paulo', labelKey: 'admin.settings.localization.timezone_zones.America_Sao_Paulo', offset: '-03:00' },
  { value: 'America/Argentina/Buenos_Aires', labelKey: 'admin.settings.localization.timezone_zones.America_Argentina_Buenos_Aires', offset: '-03:00' },
  { value: 'America/Mexico_City', labelKey: 'admin.settings.localization.timezone_zones.America_Mexico_City', offset: '-06:00' },
  { value: 'America/Halifax', labelKey: 'admin.settings.localization.timezone_zones.America_Halifax', offset: '-04:00' },
  { value: 'America/St_Johns', labelKey: 'admin.settings.localization.timezone_zones.America_St_Johns', offset: '-03:30' },
  { value: 'Europe/London', labelKey: 'admin.settings.localization.timezone_zones.Europe_London', offset: '+00:00' },
  { value: 'Europe/Paris', labelKey: 'admin.settings.localization.timezone_zones.Europe_Paris', offset: '+01:00' },
  { value: 'Europe/Berlin', labelKey: 'admin.settings.localization.timezone_zones.Europe_Berlin', offset: '+01:00' },
  { value: 'Europe/Madrid', labelKey: 'admin.settings.localization.timezone_zones.Europe_Madrid', offset: '+01:00' },
  { value: 'Europe/Rome', labelKey: 'admin.settings.localization.timezone_zones.Europe_Rome', offset: '+01:00' },
  { value: 'Europe/Amsterdam', labelKey: 'admin.settings.localization.timezone_zones.Europe_Amsterdam', offset: '+01:00' },
  { value: 'Europe/Stockholm', labelKey: 'admin.settings.localization.timezone_zones.Europe_Stockholm', offset: '+01:00' },
  { value: 'Europe/Zurich', labelKey: 'admin.settings.localization.timezone_zones.Europe_Zurich', offset: '+01:00' },
  { value: 'Europe/Prague', labelKey: 'admin.settings.localization.timezone_zones.Europe_Prague', offset: '+01:00' },
  { value: 'Europe/Warsaw', labelKey: 'admin.settings.localization.timezone_zones.Europe_Warsaw', offset: '+01:00' },
  { value: 'Europe/Moscow', labelKey: 'admin.settings.localization.timezone_zones.Europe_Moscow', offset: '+03:00' },
  { value: 'Europe/Istanbul', labelKey: 'admin.settings.localization.timezone_zones.Europe_Istanbul', offset: '+03:00' },
  { value: 'Europe/Helsinki', labelKey: 'admin.settings.localization.timezone_zones.Europe_Helsinki', offset: '+02:00' },
  { value: 'Europe/Athens', labelKey: 'admin.settings.localization.timezone_zones.Europe_Athens', offset: '+02:00' },
  { value: 'Asia/Shanghai', labelKey: 'admin.settings.localization.timezone_zones.Asia_Shanghai', offset: '+08:00' },
  { value: 'Asia/Tokyo', labelKey: 'admin.settings.localization.timezone_zones.Asia_Tokyo', offset: '+09:00' },
  { value: 'Asia/Seoul', labelKey: 'admin.settings.localization.timezone_zones.Asia_Seoul', offset: '+09:00' },
  { value: 'Asia/Singapore', labelKey: 'admin.settings.localization.timezone_zones.Asia_Singapore', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', labelKey: 'admin.settings.localization.timezone_zones.Asia_Hong_Kong', offset: '+08:00' },
  { value: 'Asia/Taipei', labelKey: 'admin.settings.localization.timezone_zones.Asia_Taipei', offset: '+08:00' },
  { value: 'Asia/Kolkata', labelKey: 'admin.settings.localization.timezone_zones.Asia_Kolkata', offset: '+05:30' },
  { value: 'Asia/Dubai', labelKey: 'admin.settings.localization.timezone_zones.Asia_Dubai', offset: '+04:00' },
  { value: 'Asia/Bangkok', labelKey: 'admin.settings.localization.timezone_zones.Asia_Bangkok', offset: '+07:00' },
  { value: 'Asia/Jakarta', labelKey: 'admin.settings.localization.timezone_zones.Asia_Jakarta', offset: '+07:00' },
  { value: 'Asia/Manila', labelKey: 'admin.settings.localization.timezone_zones.Asia_Manila', offset: '+08:00' },
  { value: 'Asia/Kuala_Lumpur', labelKey: 'admin.settings.localization.timezone_zones.Asia_Kuala_Lumpur', offset: '+08:00' },
  { value: 'Asia/Tashkent', labelKey: 'admin.settings.localization.timezone_zones.Asia_Tashkent', offset: '+05:00' },
  { value: 'Asia/Karachi', labelKey: 'admin.settings.localization.timezone_zones.Asia_Karachi', offset: '+05:00' },
  { value: 'Asia/Dhaka', labelKey: 'admin.settings.localization.timezone_zones.Asia_Dhaka', offset: '+06:00' },
  { value: 'Australia/Sydney', labelKey: 'admin.settings.localization.timezone_zones.Australia_Sydney', offset: '+10:00' },
  { value: 'Australia/Melbourne', labelKey: 'admin.settings.localization.timezone_zones.Australia_Melbourne', offset: '+10:00' },
  { value: 'Australia/Perth', labelKey: 'admin.settings.localization.timezone_zones.Australia_Perth', offset: '+08:00' },
  { value: 'Australia/Brisbane', labelKey: 'admin.settings.localization.timezone_zones.Australia_Brisbane', offset: '+10:00' },
  { value: 'Australia/Adelaide', labelKey: 'admin.settings.localization.timezone_zones.Australia_Adelaide', offset: '+09:30' },
  { value: 'Pacific/Auckland', labelKey: 'admin.settings.localization.timezone_zones.Pacific_Auckland', offset: '+12:00' },
  { value: 'Pacific/Fiji', labelKey: 'admin.settings.localization.timezone_zones.Pacific_Fiji', offset: '+12:00' },
  { value: 'Pacific/Honolulu', labelKey: 'admin.settings.localization.timezone_zones.Pacific_Honolulu', offset: '-10:00' },
  { value: 'Pacific/Guam', labelKey: 'admin.settings.localization.timezone_zones.Pacific_Guam', offset: '+10:00' },
  { value: 'Africa/Cairo', labelKey: 'admin.settings.localization.timezone_zones.Africa_Cairo', offset: '+02:00' },
  { value: 'Africa/Johannesburg', labelKey: 'admin.settings.localization.timezone_zones.Africa_Johannesburg', offset: '+02:00' },
  { value: 'Africa/Lagos', labelKey: 'admin.settings.localization.timezone_zones.Africa_Lagos', offset: '+01:00' },
  { value: 'Africa/Nairobi', labelKey: 'admin.settings.localization.timezone_zones.Africa_Nairobi', offset: '+03:00' },
]

const timezoneOptions = computed(() =>
  tzData.map(item => ({
    ...item,
    label: t(item.labelKey),
  }))
)
</script>
