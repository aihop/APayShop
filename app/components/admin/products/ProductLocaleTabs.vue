<template>
  <div
    v-if="locales.length > 1"
    class="border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#121214] mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6"
  >
    <nav class="flex space-x-2 overflow-x-auto hide-scrollbar pb-2">
      <button
        v-for="locale in locales"
        :key="locale"
        type="button"
        :disabled="locale !== defaultLocale && !hasDefaultName"
        :class="[
          'shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
          currentLocale === locale
            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            : locale !== defaultLocale && !hasDefaultName
              ? 'text-gray-600 cursor-not-allowed border border-transparent'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'
        ]"
        @click="handleSelect(locale)"
      >
        <UIcon
          :name="locale === defaultLocale ? 'ph:star-fill' : 'ph:translate'"
          :class="[
            'w-4 h-4',
            locale === defaultLocale ? 'text-yellow-500' : ''
          ]"
        />
        {{ locale.toUpperCase() }}
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  locales: string[]
  defaultLocale: string
  currentLocale: string
  hasDefaultName: boolean
}>()

const emit = defineEmits<{
  select: [locale: string]
}>()

function handleSelect(locale: string) {
  if (locale !== props.defaultLocale && !props.hasDefaultName) {
    return
  }

  emit('select', locale)
}
</script>
