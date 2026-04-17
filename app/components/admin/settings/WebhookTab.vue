<template>
  <div class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
        <UIcon
          name="ph:plugs-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">Webhook Configuration</h2>
    </div>
    <div class="p-6 space-y-6">
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
          :ui="{ base: 'bg-[#09090b]' }"
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
          :ui="{ base: 'bg-[#09090b]' }"
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