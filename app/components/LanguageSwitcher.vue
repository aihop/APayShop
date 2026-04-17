<template>
  <ClientOnly>
    <UDropdownMenu
      :items="dropdownItems"
      :popper="{ placement: 'bottom-end', offsetDistance: 8 }"
      :ui="{ 
        content: 'bg-[#121214]/95 backdrop-blur-xl border border-gray-800/60 shadow-2xl rounded-xl overflow-hidden min-w-[160px]',
        item: 'px-3 py-2.5 text-sm font-medium transition-all duration-200 text-gray-300 hover:text-white hover:bg-gray-800/50',
      }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        class="text-gray-400 hover:text-white hover:bg-gray-800/40 transition-all duration-300 rounded-lg px-3 py-2 flex items-center gap-2 border border-transparent hover:border-gray-700/50"
      >
        <UIcon
          name="ph:translate-duotone"
          class="w-5 h-5"
        />
        <span
          class="text-sm font-medium tracking-wide transition-all duration-300"
          v-if="showText"
        >
          {{ currentLocaleName }}
        </span>
        <UIcon
          name="ph:caret-down-bold"
          class="w-3 h-3 opacity-50 ml-1"
          v-if="showText"
        />
      </UButton>
    </UDropdownMenu>
    <template #fallback>
      <div class="px-3 py-2 flex items-center gap-2 rounded-lg border border-transparent">
        <USkeleton class="h-4 w-4 rounded-full bg-gray-800/50" />
        <USkeleton
          v-if="showText"
          class="h-4 w-16 bg-gray-800/50 rounded"
        />
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentLocale: string
  locales: any[]
  showText?: boolean
}>()

const emit = defineEmits<{
  (e: 'switch', code: any): void
}>()

const currentLocaleName = computed(() => {
  const found = props.locales.find((l) => l.code === props.currentLocale)
  return found && found.name ? found.name : props.currentLocale
})

const dropdownItems = computed(() => {
  return [
    props.locales.map((loc) => ({
      label: loc.name || loc.code,
      icon:
        props.currentLocale === loc.code ? 'ph:check-circle-fill' : 'ph:globe',
      iconClass:
        props.currentLocale === loc.code ? 'text-primary-400' : 'text-gray-500',
      onSelect: () => emit('switch', loc.code),
    })),
  ]
})
</script>