<template>
  <FullScreenModal
    :model-value="open"
    :title="title"
    :default-fullscreen="false"
    max-width="sm:max-w-2xl"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="$t('admin.settings.email.tpl_code')" required>
          <UInput
            :model-value="draft.code"
            placeholder="verify_email"
            size="md"
            class="w-full"
            :disabled="isEditing"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            @update:model-value="updateDraft('code', $event)"
          />
        </UFormField>
        <UFormField :label="$t('admin.settings.email.tpl_name')" required>
          <UInput
            :model-value="draft.name"
            placeholder="注册验证"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            @update:model-value="updateDraft('name', $event)"
          />
        </UFormField>
      </div>

      <UFormField :label="$t('admin.settings.email.tpl_subject')" required>
        <UInput
          :model-value="draft.subject"
          placeholder="验证你的邮箱 - {{site_name}}"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          @update:model-value="updateDraft('subject', $event)"
        />
      </UFormField>

      <UFormField :label="$t('admin.settings.email.tpl_variables')" :description="$t('admin.settings.email.tpl_variables_desc')">
        <UInput
          :model-value="variablesInput"
          placeholder="nickname, verify_link, site_name"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          @update:model-value="emit('update:variables-input', $event)"
        />
      </UFormField>

      <UFormField :label="$t('admin.settings.email.tpl_html')" required>
        <UTextarea
          :model-value="draft.html"
          :rows="14"
          size="md"
          class="font-mono text-sm w-full"
          placeholder="<p>你好 {{nickname}}，点击验证：<a href='{{verify_link}}'>{{verify_link}}</a></p>"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          @update:model-value="updateDraft('html', $event)"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton type="button" variant="outline" size="md" class="rounded-xl" @click="emit('update:open', false)">
        {{ $t('admin.settings.email.cancel') }}
      </UButton>
      <UButton type="button" color="primary" size="md" class="rounded-xl" @click="emit('save')">
        {{ $t('admin.settings.email.save_template') }}
      </UButton>
    </template>
  </FullScreenModal>
</template>

<script setup lang="ts">
import type { EmailTemplateDraft } from './shared'

const props = defineProps<{
  open: boolean
  title: string
  draft: EmailTemplateDraft
  variablesInput: string
  isEditing: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:variables-input': [value: string]
  save: []
}>()

function updateDraft<K extends keyof EmailTemplateDraft>(key: K, value: EmailTemplateDraft[K]) {
  props.draft[key] = value
}
</script>
