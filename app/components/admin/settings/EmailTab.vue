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

        <div class="pt-2 pb-4 border-b border-gray-200 dark:border-gray-800/60">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{{ $t('admin.settings.email.script_title') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.settings.email.script_desc') }}</p>
        </div>

        <UFormField :label="$t('admin.settings.email.send_script')" :description="$t('admin.settings.email.send_script_desc')">
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
        <UButton type="button" size="sm" class="rounded-xl" @click="openNewTemplate">
          <template #leading>
            <UIcon name="ph:plus" class="w-4 h-4" />
          </template>
          {{ $t('admin.settings.email.add_template') }}
        </UButton>
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
              color="gray"
              icon="ph:pencil-simple"
              @click="editTemplate(idx)"
            />
            <UButton
              type="button"
              size="xs"
              variant="ghost"
              color="red"
              icon="ph:trash"
              @click="deleteTemplate(idx)"
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
    <FullScreenModal
      v-model="isTemplateModalOpen"
      :title="editingTemplateIndex >= 0 ? $t('admin.settings.email.edit_template_title') : $t('admin.settings.email.new_template_title')"
      :default-fullscreen="false"
      max-width="sm:max-w-2xl"
    >
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="$t('admin.settings.email.tpl_code')" required>
            <UInput
              v-model="editingTemplate.code"
              placeholder="verify_email"
              size="md"
              class="w-full"
              :disabled="editingTemplateIndex >= 0"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
          <UFormField :label="$t('admin.settings.email.tpl_name')" required>
            <UInput
              v-model="editingTemplate.name"
              placeholder="注册验证"
              size="md"
              class="w-full"
              :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
            />
          </UFormField>
        </div>
        <UFormField :label="$t('admin.settings.email.tpl_subject')" required>
          <UInput
            v-model="editingTemplate.subject"
            placeholder="验证你的邮箱 - {{site_name}}"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>
        <UFormField :label="$t('admin.settings.email.tpl_variables')" :description="$t('admin.settings.email.tpl_variables_desc')">
          <UInput
            v-model="variablesInput"
            placeholder="nickname, verify_link, site_name"
            size="md"
            class="w-full"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>
        <UFormField :label="$t('admin.settings.email.tpl_html')" required>
          <UTextarea
            v-model="editingTemplate.html"
            :rows="14"
            size="md"
            class="font-mono text-sm w-full"
            placeholder="<p>你好 {{nickname}}，点击验证：<a href='{{verify_link}}'>{{verify_link}}</a></p>"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton type="button" variant="outline" size="md" class="rounded-xl" @click="isTemplateModalOpen = false">
          {{ $t('admin.settings.email.cancel') }}
        </UButton>
        <UButton type="button" color="primary" size="md" class="rounded-xl" @click="saveTemplate">
          {{ $t('admin.settings.email.save_template') }}
        </UButton>
      </template>
    </FullScreenModal>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()
const { t } = useI18n()

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
]

const providerForm = reactive({
  name: 'Resend',
  code: 'resend',
  isActive: false,
  configJson: '',
  sendScript: '',
})

const defaultResendScript = `// Sandbox: { to, subject, html, config, fetch, crypto, console }
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${config.apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: config.from || 'noreply@yourdomain.com',
    to: [to],
    subject: subject,
    html: html
  })
})
if (res.ok) {
  const data = await res.json()
  return { ok: true, messageId: data.id }
}
return { ok: false, error: await res.text() }`

// Load existing provider from settings form
watchEffect(() => {
  if (props.form.email_provider_name) providerForm.name = props.form.email_provider_name
  if (props.form.email_provider_code) providerForm.code = props.form.email_provider_code
  if (props.form.email_provider_is_active !== undefined) {
    providerForm.isActive = props.form.email_provider_is_active === true || props.form.email_provider_is_active === 'true'
  }
  if (props.form.email_provider_config_json) providerForm.configJson = props.form.email_provider_config_json
  if (props.form.email_provider_send_script) providerForm.sendScript = props.form.email_provider_send_script
})

async function saveProvider() {
  isSavingProvider.value = true
  try {
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

// --- Templates ---
const templates = ref<Array<{ code: string; name: string; subject: string; variables: string[]; html: string }>>([])

watchEffect(() => {
  if (props.form.email_templates) {
    try {
      templates.value = JSON.parse(props.form.email_templates)
    } catch { /* ignore invalid JSON during editing */ }
  }
})

const templateOptions = computed(() =>
  templates.value.map((t) => ({ label: `${t.name} (${t.code})`, value: t.code }))
)

const isTemplateModalOpen = ref(false)
const editingTemplateIndex = ref(-1)
const editingTemplate = reactive({ code: '', name: '', subject: '', variables: [] as string[], html: '' })
const variablesInput = ref('')

function openNewTemplate() {
  editingTemplateIndex.value = -1
  editingTemplate.code = ''
  editingTemplate.name = ''
  editingTemplate.subject = ''
  editingTemplate.variables = []
  editingTemplate.html = ''
  variablesInput.value = ''
  isTemplateModalOpen.value = true
}

function editTemplate(idx: number) {
  editingTemplateIndex.value = idx
  const tpl = templates.value[idx]
  editingTemplate.code = tpl.code
  editingTemplate.name = tpl.name
  editingTemplate.subject = tpl.subject
  editingTemplate.variables = [...tpl.variables]
  editingTemplate.html = tpl.html
  variablesInput.value = tpl.variables.join(', ')
  isTemplateModalOpen.value = true
}

function deleteTemplate(idx: number) {
  templates.value.splice(idx, 1)
  syncTemplatesToForm()
  toast.add({
    title: t('admin.common.success'),
    description: t('admin.settings.email.toast_template_deleted'),
    color: 'success',
  })
}

function saveTemplate() {
  const vars = variablesInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const tpl = {
    code: editingTemplate.code.trim(),
    name: editingTemplate.name.trim(),
    subject: editingTemplate.subject.trim(),
    variables: vars,
    html: editingTemplate.html.trim(),
  }

  if (!tpl.code || !tpl.name) {
    toast.add({ title: t('admin.common.error'), description: t('admin.settings.email.tpl_code_name_required'), color: 'error' })
    return
  }

  if (editingTemplateIndex.value >= 0) {
    templates.value[editingTemplateIndex.value] = tpl
  } else {
    if (templates.value.some((t) => t.code === tpl.code)) {
      toast.add({ title: t('admin.common.error'), description: t('admin.settings.email.tpl_duplicate'), color: 'error' })
      return
    }
    templates.value.push(tpl)
  }

  syncTemplatesToForm()
  isTemplateModalOpen.value = false
  toast.add({ title: t('admin.common.success'), description: t('admin.settings.email.toast_template_saved'), color: 'success' })
}

function syncTemplatesToForm() {
  props.form.email_templates = JSON.stringify(templates.value)
}

// --- Test ---
const testEmail = reactive({ to: '', templateCode: '' })
const isSendingTest = ref(false)
const testResult = ref<{ ok: boolean; messageId?: string; error?: string } | null>(null)

async function sendTestEmail() {
  if (!testEmail.to || !testEmail.templateCode) {
    toast.add({ title: t('admin.common.error'), description: t('admin.settings.email.test_fill_fields'), color: 'error' })
    return
  }
  isSendingTest.value = true
  testResult.value = null
  try {
    const res = await $fetch('/api/admin/email/test', {
      method: 'POST',
      body: {
        to: testEmail.to,
        templateCode: testEmail.templateCode,
      },
    })
    testResult.value = res
  } catch (e: any) {
    testResult.value = { ok: false, error: e.data?.message || e.message }
  } finally {
    isSendingTest.value = false
  }
}
</script>
