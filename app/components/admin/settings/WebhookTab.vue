<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
        <UIcon
          name="ph:plugs-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Webhook Configuration</h2>
    </div>
    <div class="p-6 space-y-6">

      <!-- AI Gateway -->
      <div class="pb-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">AI Gateway</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Upstream backend that powers the gateway API layer.</p>
      </div>

      <UFormField
        label="AI Gateway URL"
        description="The base URL of the upstream ainode gateway backend. All proxy requests will be forwarded here."
      >
        <UInput
          v-model="form.ai_gateway_url"
          placeholder="https://api.ainode.run"
          icon="ph:cloud-arrow-up"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <!-- Webhook -->
      <div class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Webhook</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Send event notifications to external services.</p>
      </div>

      <UFormField
        label="Webhook URL"
        description="The URL to receive event notifications (e.g., user registration, successful payment)."
      >
        <UInput
          v-model="form.webhook_url"
          placeholder="https://your-domain.com/webhook"
          icon="ph:link"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        label="Webhook Secret"
        description="Secret key used to sign the webhook payload for security verification."
      >
        <UInput
          v-model="form.webhook_secret"
          type="password"
          placeholder="Enter a secret key"
          icon="ph:lock-key"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  form: any
}>()
</script>