<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
        <UIcon
          name="ph:plugs-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.integration.title') }}</h2>
    </div>
    <div class="p-6 space-y-6">

      <!-- Shared Auth Token -->
      <div class="pb-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.integration.shared_auth_token') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.integration.shared_auth_token_desc') }}</p>
      </div>

      <UFormField
        :label="$t('admin.settings.integration.token')"
        :description="$t('admin.settings.integration.token_desc')"
      >
        <UInput
          v-model="form.integration_token"
          type="password"
          placeholder="Enter a shared integration token"
          icon="ph:key"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <!-- AI Gateway -->
      <div class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.integration.ai_gateway') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.integration.ai_gateway_desc') }}</p>
      </div>

      <UFormField
        :label="$t('admin.settings.integration.ai_gateway_url')"
        :description="$t('admin.settings.integration.ai_gateway_url_desc')"
      >
        <UInput
          v-model="form.ai_gateway_url"
          icon="ph:cloud-arrow-up"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <!-- Webhook -->
      <div class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.integration.webhook') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.integration.webhook_desc') }}</p>
      </div>

      <UFormField
        :label="$t('admin.settings.integration.webhook_url')"
        :description="$t('admin.settings.integration.webhook_url_desc')"
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
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  form: any
}>()
</script>
