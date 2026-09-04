<template>
  <div class="space-y-8">
    <!-- Email Verification Policy Section -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
          <UIcon name="ph:shield-check-fill" class="w-5 h-5" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.email.policy_title') }}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ $t('admin.settings.email.policy_desc') }}</p>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 gap-3">
          <!-- Disabled Policy -->
          <label
            class="flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all"
            :class="(form.email_verify_policy || 'banner') === 'disabled'
              ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#09090b] hover:border-gray-300 dark:hover:border-gray-700'"
          >
            <input
              type="radio"
              name="email_verify_policy"
              value="disabled"
              :checked="(form.email_verify_policy || 'banner') === 'disabled'"
              class="mt-1 text-emerald-600 focus:ring-emerald-500"
              @change="form.email_verify_policy = 'disabled'"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-gray-900 dark:text-white">{{ $t('admin.settings.email.policy_disabled') }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">极简直通</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{{ $t('admin.settings.email.policy_disabled_desc') }}</p>
            </div>
          </label>

          <!-- Banner Policy (Recommended) -->
          <label
            class="flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all"
            :class="(form.email_verify_policy || 'banner') === 'banner'
              ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#09090b] hover:border-gray-300 dark:hover:border-gray-700'"
          >
            <input
              type="radio"
              name="email_verify_policy"
              value="banner"
              :checked="(form.email_verify_policy || 'banner') === 'banner'"
              class="mt-1 text-emerald-600 focus:ring-emerald-500"
              @change="form.email_verify_policy = 'banner'"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-gray-900 dark:text-white">{{ $t('admin.settings.email.policy_banner') }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-medium">推荐默认</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{{ $t('admin.settings.email.policy_banner_desc') }}</p>
            </div>
          </label>

          <!-- Strict Policy -->
          <label
            class="flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all"
            :class="(form.email_verify_policy || 'banner') === 'strict'
              ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#09090b] hover:border-gray-300 dark:hover:border-gray-700'"
          >
            <input
              type="radio"
              name="email_verify_policy"
              value="strict"
              :checked="(form.email_verify_policy || 'banner') === 'strict'"
              class="mt-1 text-emerald-600 focus:ring-emerald-500"
              @change="form.email_verify_policy = 'strict'"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-gray-900 dark:text-white">{{ $t('admin.settings.email.policy_strict') }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-medium">强防刷</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{{ $t('admin.settings.email.policy_strict_desc') }}</p>
            </div>
          </label>
        </div>
      </div>
    </div>

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
            :placeholder="configJsonPlaceholder"
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

    <!-- Email Logs Section -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <UIcon name="ph:clock-counter-clockwise-fill" class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.email.logs_title') }}</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ $t('admin.settings.email.logs_desc') }}</p>
          </div>
        </div>
        <UButton
          type="button"
          size="sm"
          variant="soft"
          color="neutral"
          class="rounded-xl"
          :loading="logsLoading"
          @click="fetchEmailLogs"
        >
          <template #leading>
            <UIcon name="ph:arrow-clockwise" class="w-4 h-4" />
          </template>
          {{ $t('admin.settings.email.refresh_logs') }}
        </UButton>
      </div>

      <!-- Logs Search & Filter -->
      <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap bg-gray-50/50 dark:bg-black/20">
        <UInput
          v-model="logsSearch"
          placeholder="搜索收件人 / 邮件主题..."
          size="sm"
          class="w-full sm:w-64"
          icon="ph:magnifying-glass"
          @keydown.enter="fetchEmailLogs"
        />
        <USelect
          v-model="logsStatus"
          :items="statusFilterOptions"
          size="sm"
          class="w-full sm:w-36"
          @change="fetchEmailLogs"
        />
      </div>

      <!-- Logs Table -->
      <div v-if="logsLoading" class="p-8 text-center text-sm text-gray-500">
        <UIcon name="ph:spinner" class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
        正在加载日志...
      </div>
      <div v-else-if="emailLogsList.length === 0" class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ $t('admin.settings.email.no_logs') }}
      </div>
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-800/60 overflow-x-auto">
        <div
          v-for="log in emailLogsList"
          :key="log.id"
          class="px-6 py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-gray-900 dark:text-white truncate">{{ log.to }}</span>
              <UBadge
                :color="log.status === 'success' ? 'success' : 'error'"
                variant="subtle"
                size="xs"
              >
                {{ log.status === 'success' ? $t('admin.settings.email.log_status_success') : $t('admin.settings.email.log_status_failed') }}
              </UBadge>
              <span v-if="log.templateCode" class="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">
                {{ log.templateCode }}
              </span>
            </div>
            <div class="text-gray-600 dark:text-gray-300 truncate text-xs">
              {{ log.subject }}
            </div>
            <div v-if="log.error" class="text-xs text-red-500 truncate">
              {{ log.error }}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-gray-400">
              {{ formatDateTime(log.createdAt) }}
            </span>
            <UButton
              v-if="log.html"
              size="xs"
              variant="soft"
              color="primary"
              class="rounded-lg"
              @click="openLogPreview(log)"
            >
              {{ $t('admin.settings.email.log_preview') }}
            </UButton>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="ph:arrow-clockwise"
              class="rounded-lg"
              :title="$t('admin.settings.email.log_resend')"
              :loading="resendingId === log.id"
              @click="resendEmailLog(log)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Log Content Preview Modal -->
    <FullScreenModal
      v-model="isPreviewModalOpen"
      :title="selectedLog?.subject || $t('admin.settings.email.log_preview_modal_title')"
      :default-fullscreen="false"
      max-width="sm:max-w-2xl"
    >
      <div v-if="selectedLog" class="space-y-4">
        <div class="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div>
            <p class="text-xs text-gray-500">To: <span class="font-mono text-gray-700 dark:text-gray-300">{{ selectedLog.to }}</span> · {{ formatDateTime(selectedLog.createdAt) }}</p>
          </div>
          <UBadge :color="selectedLog.status === 'success' ? 'success' : 'error'" variant="subtle">
            {{ selectedLog.status === 'success' ? '成功' : '失败' }}
          </UBadge>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-medium text-gray-500">邮件主题：</div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-black/30 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            {{ selectedLog.subject }}
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-medium text-gray-500">HTML 原文快照：</div>
          <div class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-zinc-900 max-h-96 overflow-auto text-xs font-mono select-all">
            <div v-html="selectedLog.html" class="prose dark:prose-invert max-w-none"></div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <UButton
            v-if="selectedLog"
            color="primary"
            icon="ph:paper-plane-tilt"
            :loading="resendingId === selectedLog.id"
            @click="resendEmailLog(selectedLog)"
          >
            {{ $t('admin.settings.email.log_resend') }}
          </UButton>
          <UButton color="neutral" variant="soft" @click="isPreviewModalOpen = false">
            {{ $t('admin.settings.email.cancel') }}
          </UButton>
        </div>
      </template>
    </FullScreenModal>

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
import EmailTemplateModal from './email/EmailTemplateModal.vue'
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

const configJsonPlaceholder = computed(() => {
  switch (providerForm.code) {
    case 'bird':
      return '{\n  "apiKey": "your_access_key",\n  "workspaceId": "your_workspace_id",\n  "channelId": "your_channel_id",\n  "fromName": "Support Team"\n}'
    case 'resend':
      return '{\n  "apiKey": "re_xxx",\n  "from": "noreply@yourdomain.com"\n}'
    case 'sendgrid':
      return '{\n  "apiKey": "SG.xxx",\n  "from": "noreply@yourdomain.com"\n}'
    case 'mailgun':
      return '{\n  "apiKey": "key-xxx",\n  "domain": "mg.yourdomain.com",\n  "from": "noreply@yourdomain.com"\n}'
    case 'postmark':
      return '{\n  "serverToken": "xxx",\n  "from": "noreply@yourdomain.com"\n}'
    case 'ses':
      return '{\n  "region": "us-east-1",\n  "accessKeyId": "AKIA...",\n  "secretAccessKey": "...",\n  "from": "noreply@yourdomain.com"\n}'
    case 'smtp':
      return '{\n  "host": "mail.smtp2go.com",\n  "port": 587,\n  "username": "...",\n  "password": "...",\n  "from": "noreply@yourdomain.com"\n}'
    default:
      return '{\n  "apiKey": "re_xxx",\n  "from": "noreply@yourdomain.com"\n}'
  }
})

const savedProviders = ref<any[]>([])

const fetchProviders = async () => {
  try {
    const res: any = await $fetch('/api/admin/email/providers')
    if (Array.isArray(res)) {
      savedProviders.value = res
      const currentCode = providerForm.code || props.form.email_provider_code || 'resend'
      const matched = res.find(p => p.isActive) || res.find(p => p.code === currentCode)
      if (matched) {
        if (!providerForm.configJson && matched.configJson) {
          providerForm.configJson = matched.configJson
        }
        if (!providerForm.sendScript && matched.sendScript) {
          providerForm.sendScript = matched.sendScript
        }
        if (matched.name && !props.form.email_provider_name) {
          providerForm.name = matched.name
        }
        if (matched.code && !props.form.email_provider_code) {
          providerForm.code = matched.code
        }
        syncProviderToForm()
      }
    }
  } catch (err) {
    console.error('[EmailTab] Failed to fetch email providers:', err)
  }
}

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

// Clear sendScript when switching to a built-in provider; auto-fill config if already saved
watch(() => providerForm.code, (newCode) => {
  if (newCode !== '__custom__') {
    providerForm.sendScript = ''
  }
  const matched = savedProviders.value.find(p => p.code === newCode)
  if (matched) {
    if (matched.configJson) providerForm.configJson = matched.configJson
    if (matched.name) providerForm.name = matched.name
  }
  syncProviderToForm()
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
        email_verify_policy: props.form.email_verify_policy,
      },
    })

    await fetchProviders()

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

// Email Logs State
interface EmailLogItem {
  id: number
  to: string
  subject: string
  templateCode: string | null
  html: string | null
  provider: string | null
  status: 'success' | 'failed'
  messageId: string | null
  error: string | null
  createdAt: string | number | Date
}

const emailLogsList = ref<EmailLogItem[]>([])
const logsLoading = ref(false)
const logsTotal = ref(0)
const logsPage = ref(1)
const logsSearch = ref('')
const logsStatus = ref('all')
const isPreviewModalOpen = ref(false)
const selectedLog = ref<EmailLogItem | null>(null)

const statusFilterOptions = computed(() => [
  { label: '全部状态', value: 'all' },
  { label: '发送成功', value: 'success' },
  { label: '发送失败', value: 'failed' },
])

const formatDateTime = (val: string | number | Date | null | undefined) => {
  if (!val) return '-'
  try {
    const d = new Date(val)
    return d.toLocaleString()
  } catch {
    return String(val)
  }
}

const fetchEmailLogs = async () => {
  logsLoading.value = true
  try {
    const res: any = await $fetch('/api/admin/email/logs', {
      query: {
        page: logsPage.value,
        pageSize: 20,
        search: logsSearch.value || undefined,
        status: logsStatus.value !== 'all' ? logsStatus.value : undefined,
      },
    })
    emailLogsList.value = res.items || []
    logsTotal.value = res.total || 0
  } catch (err) {
    console.error('[EmailTab] Failed to fetch email logs:', err)
  } finally {
    logsLoading.value = false
  }
}

const resendingId = ref<number | null>(null)

const resendEmailLog = async (log: EmailLogItem) => {
  if (!log?.id || resendingId.value) return
  resendingId.value = log.id
  try {
    await $fetch('/api/admin/email/resend', {
      method: 'POST',
      body: { logId: log.id },
    })
    toast.add({
      title: t('admin.settings.email.log_resend_success'),
      color: 'success',
    })
    await fetchEmailLogs()
    if (isPreviewModalOpen.value && selectedLog.value?.id === log.id) {
      isPreviewModalOpen.value = false
    }
  } catch (err: any) {
    toast.add({
      title: t('admin.settings.email.log_resend_failed'),
      description: err?.data?.message || err?.message,
      color: 'error',
    })
  } finally {
    resendingId.value = null
  }
}

const openLogPreview = (log: EmailLogItem) => {
  selectedLog.value = log
  isPreviewModalOpen.value = true
}

onMounted(() => {
  fetchProviders()
  fetchEmailLogs()
})
</script>
