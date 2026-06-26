<template>
  <div
    class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden"
  >
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
        <UIcon
          name="ph:shopping-cart-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.checkout.title') }}</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#09090b] rounded-xl border border-gray-200 dark:border-gray-800">
        <div class="flex flex-col gap-1">
          <span class="font-medium text-gray-900 dark:text-white">{{ $t('admin.settings.checkout.allow_guest_checkout') }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.checkout.guest_checkout_desc') }}</span>
        </div>
        <USwitch v-model="form.allow_guest_checkout" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  form: any
}>()
</script>
