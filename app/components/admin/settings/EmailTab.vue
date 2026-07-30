<template>
  <div class="space-y-8 max-w-3xl">
    <!-- Provider Section -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
          <UIcon name="ph:envelope-fill" class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.email.provider_title') }}</h2>
      </div>
      <div class="p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.settings.email.provider')" :description="$t('admin.settings.email.provider_desc')">
            <USelect
              v-model="providerForm.code"
              :items="availableProviders"
              size="md"
              class="w-full"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
          <UFormField :label="$t('admin.settings.email.provider_name')">
            <UInput
              v-model="providerForm.name"
              placeholder="Resend"
              size="md"
              class="w-full"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#09090b] rounded-xl border border-gray-200 dark:border-gray-800">
          <div class="flex flex-col gap-1">
            <span class="font-medium text-gray-900 dark:text-white">{{ $t('admin.settings.email.enable') }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.email.enable_desc') }}</span>
          </div>
          <USwitch v-model="providerForm.isActive" />
        </div>

        <div class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.email.config_title') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.email.config_desc') }}</p>
        </div>

        <UFormField :label="$t('admin.settings.email.config_json')" :description="$t('admin.settings.email.config_json_desc')">
          <UTextarea
            v-model="providerForm.configJson"
            :rows="6"
            size="md"
            class="font-mono text-sm w-full"
            placeholder='{"apiKey": "re_xxx", "from": "noreply@yourdomain.com"}'
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>

        <div v-if="isCustomProvider" class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.email.script_title') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.email.script_desc') }}</p>
        </div>

        <UFormField :label="$t('admin.settings.email.default_template')" :description="$t('admin.settings.email.default_template_desc')">
          <USelect
            v-model="providerForm.defaultTemplateCode"
            :items="defaultTemplateOptions"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>

        <UFormField v-if="isCustomProvider" :label="$t('admin.settings.email.send_script')" :description="$t('admin.settings.email.send_script_desc')">
          <UTextarea
            v-model="providerForm.sendScript"
            :rows="12"
            size="md"
            class="font-mono text-sm w-full"
            :placeholder="defaultResendScript"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>

        <UButton
          type="button"
          color="primary"
          variant="outline"
          size="md"
          class="rounded-xl"
          @click="saveProvider"
          :loading="isSavingProvider"
          :disabled="!hasAdminPerm('settings:edit')"
        >
          {{ $t('admin.settings.email.save_provider') }}
        </UButton>
      </div>
    </div>

    <!-- Templates Section -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
            <UIcon name="ph:article-fill" class="w-5 h-5" />
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.email.templates_title') }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <UButton type="button" size="sm" color="neutral" variant="outline" class="rounded-xl" :disabled="!hasAdminPerm('settings:edit')" @click="loadDefaultTemplates">
            <template #leading>
              <UIcon name="ph:download-simple" class="w-4 h-4" />
            </template>
            Load Defaults
          </UButton>
          <UButton type="button" size="sm" class="rounded-xl" :disabled="!hasAdminPerm('settings:edit')" @click="openNewTemplate">
            <template #leading>
              <UIcon name="ph:plus" class="w-4 h-4" />
            </template>
            {{ $t('admin.settings.email.add_template') }}
          </UButton>
        </div>
      </div>

      <div v-if="templates.length === 0" class="p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
        {{ $t('admin.settings.email.no_templates') }}
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-800/60">
        <div
          v-for="(tpl, idx) in templates"
          :key="tpl.code"
          class="px-6 py-4 flex items-start justify-between gap-6"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="shrink-0 text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{{ tpl.code }}</span>
              <span class="font-medium text-gray-900 dark:text-white truncate">{{ tpl.name }}</span>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">{{ tpl.subject }}</div>
            <div v-if="tpl.variables?.length" class="flex items-center gap-1.5 flex-wrap">
              <span
                v-for="v in tpl.variables"
                :key="v"
                class="text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-mono"
              >{{ v }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 pt-0.5">
            <UButton
              type="button"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="ph:pencil-simple"
              @click="editTemplate(idx)"
              :disabled="!hasAdminPerm('settings:edit')"
            />
            <UButton
              type="button"
              size="xs"
              variant="ghost"
              color="error"
              icon="ph:trash"
              @click="deleteTemplate(idx)"
              :disabled="!hasAdminPerm('settings:edit')"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Test Email -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <UIcon name="ph:paper-plane-tilt-fill" class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.email.test_title') }}</h2>
      </div>
      <div class="p-6 space-y-4">
        <div class="flex items-end gap-4 flex-wrap">
          <UFormField :label="$t('admin.settings.email.test_to')" class="w-full sm:flex-1 sm:min-w-[200px]">
            <UInput
              v-model="testEmail.to"
              placeholder="test@example.com"
              size="md"
              class="w-full"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
          <UFormField :label="$t('admin.settings.email.test_template')" class="w-full sm:flex-1 sm:min-w-[200px]">
            <USelect
              v-model="testEmail.templateCode"
              :items="templateOptions"
              size="md"
              class="w-full"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
          <UButton
            type="button"
            color="primary"
            size="md"
            class="rounded-xl bg-emerald-600 hover:bg-emerald-500 shrink-0"
            @click="sendTestEmail"
            :loading="isSendingTest"
            :disabled="!hasAdminPerm('settings:edit')"
          >
            {{ $t('admin.settings.email.send_test') }}
          </UButton>
        </div>
        <div v-if="testResult" class="p-3 rounded-xl text-sm" :class="testResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'">
          {{ testResult.ok ? `${$t('admin.settings.email.test_success')} (ID: ${testResult.messageId})` : `${$t('admin.settings.email.test_failed')}: ${testResult.error}` }}
        </div>
      </div>
    </div>

    <!-- Template Edit Modal -->
    <EmailTemplateModal
      :open="isTemplateModalOpen"
      :title="editingTemplateIndex >= 0 ? $t('admin.settings.email.edit_template_title') : $t('admin.settings.email.new_template_title')"
      :draft="editingTemplate"
      :variables-input="variablesInput"
      :is-editing="editingTemplateIndex >= 0"
      @update:open="isTemplateModalOpen = $event"
      @update:variables-input="variablesInput = $event"
      @save="saveTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_RESEND_SCRIPT } from './email/shared'

const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const { t } = useI18n()
const translate = (key: string) => t(key as any)

const props = defineProps<{
  form: any
}>()

// --- Provider ---
const isSavingProvider = ref(false)

const availableProviders = [
  { label: 'Resend', value: 'resend' },
  { label: 'SendGrid', value: 'sendgrid' },
  { label: 'Mailgun', value: 'mailgun' },
  { label: 'Postmark', value: 'postmark' },
  { label: 'AWS SES', value: 'ses' },
  { label: 'Bird (MessageBird)', value: 'bird' },
  { label: 'SMTP (via smtp2go)', value: 'smtp' },
  { label: t('admin.settings.email.custom_provider'), value: '__custom__' },
]

const isCustomProvider = computed(() => providerForm.code === '__custom__')

const providerForm = reactive({
  name: 'Resend',
  code: 'resend',
  isActive: false,
  configJson: '',
  sendScript: '',
  defaultTemplateCode: '__none__',
})

const defaultResendScript = DEFAULT_RESEND_SCRIPT

// Load existing provider from settings form into providerForm
watchEffect(() => {
  const f = props.form
  if (f.email_provider_name) providerForm.name = f.email_provider_name
  if (f.email_provider_code) providerForm.code = f.email_provider_code
  if (f.email_provider_is_active !== undefined) {
    providerForm.isActive = f.email_provider_is_active === true || f.email_provider_is_active === 'true'
  }
  if (f.email_provider_config_json) providerForm.configJson = f.email_provider_config_json
  if (f.email_provider_send_script) providerForm.sendScript = f.email_provider_send_script
  providerForm.defaultTemplateCode = f.email_default_template || '__none__'
})

// Clear sendScript when switching to a built-in provider (local files handle it)
watch(() => providerForm.code, (newCode) => {
  if (newCode !== '__custom__') {
    providerForm.sendScript = ''
  }
})

// Sync providerForm values back to props.form so the main "Save Changes" has them too
function syncProviderToForm() {
  const f = props.form
  f.email_provider_name = providerForm.name
  f.email_provider_code = providerForm.code
  f.email_provider_is_active = providerForm.isActive
  f.email_provider_config_json = providerForm.configJson
  f.email_provider_send_script = providerForm.sendScript
  f.email_default_template = providerForm.defaultTemplateCode
}

// Also auto-sync on every provider form change so that main "Save Changes" always has the data
watch(providerForm, () => {
  syncProviderToForm()
}, { deep: true })

async function saveProvider() {
  isSavingProvider.value = true
  try {
    // 1. Sync provider values + templates back to form so all data is captured
    syncProviderToForm()
    syncTemplatesToForm()

    // 2. Save provider to email_providers table
    await $fetch('/api/admin/email/providers', {
      method: 'POST',
      body: {
        name: providerForm.name,
        code: providerForm.code,
        isActive: providerForm.isActive,
        configJson: providerForm.configJson,
        sendScript: providerForm.sendScript,
      },
    })

    // 3. Save templates + email settings to settings table
    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: {
        email_templates: props.form.email_templates,
        email_provider_name: providerForm.name,
        email_provider_code: providerForm.code,
        email_provider_is_active: providerForm.isActive,
        email_provider_config_json: providerForm.configJson,
        email_provider_send_script: providerForm.sendScript,
        email_default_template: providerForm.defaultTemplateCode,
      },
    })

    toast.add({
      title: t('admin.common.success'),
      description: t('admin.settings.email.toast_provider_saved'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: e.data?.message || t('admin.settings.email.toast_provider_failed'),
      color: 'error',
    })
  } finally {
    isSavingProvider.value = false
  }
}

const {
  templates,
  templateOptions,
  defaultTemplateOptions,
  isTemplateModalOpen,
  editingTemplateIndex,
  editingTemplate,
  variablesInput,
  openNewTemplate,
  editTemplate,
  deleteTemplate,
  saveTemplate,
  syncTemplatesToForm,
  loadDefaultTemplates,
  testEmail,
  isSendingTest,
  testResult,
  sendTestEmail,
} = useEmailTemplateManager({
  form: props.form,
  toast,
  t: translate,
})
</script>
