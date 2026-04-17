<template>
  <div
    class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden"
  >
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
        <UIcon
          name="ph:shopping-cart-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">Checkout & Store Policies</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between p-4 bg-[#09090b] rounded-xl border border-gray-800">
        <div class="flex flex-col gap-1">
          <span class="font-medium text-white">Allow Guest Checkout</span>
          <span class="text-xs text-gray-400">If disabled, unauthenticated users will be redirected to the login page when attempting to purchase.</span>
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