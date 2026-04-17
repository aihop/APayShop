<template>
  <div class="min-h-[80vh] flex flex-col items-center justify-center p-4">
    <div class="max-w-md w-full bg-[#121214] border border-gray-800/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl"></div>

      <div class="relative z-10">
        <div class="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <UIcon
            name="ph:x-circle-fill"
            class="w-12 h-12 text-yellow-500"
          />
        </div>

        <h1 class="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
        <p class="text-gray-400 mb-8">
          It looks like you've cancelled the checkout process. Don't worry, no charges were made to your account.
        </p>

        <div class="space-y-4">
          <UButton
            color="primary"
            size="lg"
            block
            class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
            to="/"
          >
            Continue Shopping
          </UButton>

          <UButton
            color="neutral"
            variant="ghost"
            block
            to="/user/orders"
            v-if="loggedIn"
          >
            View My Orders
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCustomerAuth } from '~/composables/useCustomerAuth'

definePageMeta({
  title: 'Payment Cancelled',
})

const { loggedIn } = useCustomerAuth()
</script>