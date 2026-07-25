<template>
  <UModal v-model:open="isOpen" :ui="{ overlay: 'bg-black/30', content: 'bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-gray-700/60' }">
    <template #content>
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ title }}</h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:x-bold"
            class="-my-1"
            @click="cancel"
          />
        </div>
        
        <p class="text-gray-500 dark:text-gray-400 mb-6">
          {{ description }}
        </p>

        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="cancel">Cancel</UButton>
          <UButton color="error" variant="solid" @click="accept">Confirm</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useConfirm } from '~/composables/useConfirm'

const { isOpen, title, description, accept, cancel } = useConfirm()
</script>