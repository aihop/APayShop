<template>
  <UModal
    v-model:open="isOpen"
    :fullscreen="isFullscreen"
    :ui="{ content: !isFullscreen ? (maxWidth || 'sm:max-w-4xl') : '' }"
  >
    <template #content>
      <div
        class="flex flex-col bg-[#121214]"
        :class="isFullscreen ? 'h-screen' : 'max-h-[90vh] rounded-xl border border-gray-800'"
      >
        <!-- Header -->
        <div class="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
          <h3 class="text-xl font-bold text-white">{{ title }}</h3>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :icon="isFullscreen ? 'ph:corners-in-bold' : 'ph:corners-out-bold'"
              @click="isFullscreen = !isFullscreen"
              title="Toggle Fullscreen"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x-bold"
              @click="isOpen = false"
            />
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6 relative">
          <div
            class="mx-auto w-full"
            :class="isFullscreen ? 'max-w-5xl' : ''"
          >
            <slot />
          </div>
        </div>

        <!-- Footer -->
        <div
          v-if="$slots.footer"
          class="p-6 border-t border-gray-800 bg-gray-900/50 shrink-0"
          :class="!isFullscreen ? 'rounded-b-xl' : ''"
        >
          <div
            class="mx-auto flex justify-end gap-3 w-full"
            :class="isFullscreen ? 'max-w-5xl' : ''"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  defaultFullscreen?: boolean
  maxWidth?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isFullscreen = ref(props.defaultFullscreen ?? true)
</script>