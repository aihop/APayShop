<template>
  <div class="min-w-0">
    <div class="text-[11px] font-medium uppercase tracking-wide text-gray-500">{{ label }}</div>
    <button v-if="copyable && displayValue !== '-'" type="button" class="mt-1 max-w-full break-all text-left font-mono text-xs text-gray-900 hover:text-purple-500 dark:text-gray-200" @click="$emit('copy', displayValue)">{{ displayValue }}</button>
    <div v-else class="mt-1 break-all text-sm text-gray-900 dark:text-gray-200">{{ displayValue }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string; value?: unknown; copyable?: boolean }>()
defineEmits<{ copy: [value: string] }>()
const displayValue = computed(() => props.value === null || props.value === undefined || props.value === '' ? '-' : String(props.value))
</script>
