import type { Ref } from 'vue'
import type { EmailTemplate, EmailTemplateDraft, EmailTestResult } from '../components/admin/settings/email/shared'

interface UseEmailTemplateManagerOptions {
  form: Record<string, any>
  toast: ReturnType<typeof useToast>
  t: (key: string) => string
}

function createEmptyTemplateDraft(): EmailTemplateDraft {
  return {
    code: '',
    name: '',
    subject: '',
    variables: [],
    html: '',
  }
}

export function useEmailTemplateManager(options: UseEmailTemplateManagerOptions) {
  const { form, toast, t } = options
  const { locale } = useI18n()

  const templates = ref<EmailTemplate[]>([])

  watchEffect(() => {
    if (form.email_templates) {
      try {
        templates.value = JSON.parse(form.email_templates)
      } catch {
        // Ignore invalid JSON while the parent settings form is being edited.
      }
    }
  })

  const templateOptions = computed(() =>
    templates.value.map((template) => ({
      label: `${template.name} (${template.code})`,
      value: template.code,
    }))
  )

  const defaultTemplateOptions = computed(() => {
    const options = templates.value.map((template) => ({
      label: `${template.name} (${template.code})`,
      value: template.code,
    }))

    return [
      { label: t('admin.settings.email.no_default_template'), value: '__none__' },
      ...options,
    ]
  })

  const isTemplateModalOpen = ref(false)
  const editingTemplateIndex = ref(-1)
  const editingTemplate = reactive<EmailTemplateDraft>(createEmptyTemplateDraft())
  const variablesInput = ref('')

  function syncTemplatesToForm() {
    form.email_templates = JSON.stringify(templates.value)
  }

  function resetEditingTemplate() {
    Object.assign(editingTemplate, createEmptyTemplateDraft())
    variablesInput.value = ''
  }

  function openNewTemplate() {
    editingTemplateIndex.value = -1
    resetEditingTemplate()
    isTemplateModalOpen.value = true
  }

  function editTemplate(index: number) {
    editingTemplateIndex.value = index
    const template = templates.value[index]

    Object.assign(editingTemplate, {
      code: template.code,
      name: template.name,
      subject: template.subject,
      variables: [...template.variables],
      html: template.html,
    })
    variablesInput.value = template.variables.join(', ')
    isTemplateModalOpen.value = true
  }

  function deleteTemplate(index: number) {
    templates.value.splice(index, 1)
    syncTemplatesToForm()

    toast.add({
      title: t('admin.common.success'),
      description: t('admin.settings.email.toast_template_deleted'),
      color: 'success',
    })
  }

  function saveTemplate() {
    const variables = variablesInput.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    const template: EmailTemplate = {
      code: editingTemplate.code.trim(),
      name: editingTemplate.name.trim(),
      subject: editingTemplate.subject.trim(),
      variables,
      html: editingTemplate.html.trim(),
    }

    if (!template.code || !template.name) {
      toast.add({
        title: t('admin.common.error'),
        description: t('admin.settings.email.tpl_code_name_required'),
        color: 'error',
      })
      return
    }

    if (editingTemplateIndex.value >= 0) {
      templates.value[editingTemplateIndex.value] = template
    } else {
      if (templates.value.some((item) => item.code === template.code)) {
        toast.add({
          title: t('admin.common.error'),
          description: t('admin.settings.email.tpl_duplicate'),
          color: 'error',
        })
        return
      }

      templates.value.push(template)
    }

    syncTemplatesToForm()
    isTemplateModalOpen.value = false

    toast.add({
      title: t('admin.common.success'),
      description: t('admin.settings.email.toast_template_saved'),
      color: 'success',
    })
  }

  async function loadDefaultTemplates() {
    try {
      const localeValue = String(locale.value || 'zh').toLowerCase()
      const templateLocale = localeValue.startsWith('zh') ? 'zh' : 'en'
      const result = await $fetch<EmailTemplate[]>('/api/admin/email/default-templates', {
        query: {
          locale: templateLocale,
        },
      })
      const defaults = Array.isArray(result) ? result : []

      if (defaults.length === 0) {
        toast.add({
          title: t('admin.common.info'),
          description: 'No default templates available',
          color: 'warning',
        })
        return
      }

      const existingCodes = new Set(templates.value.map((template) => template.code))
      let addedCount = 0

      for (const template of defaults) {
        if (!existingCodes.has(template.code)) {
          templates.value.push({ ...template })
          existingCodes.add(template.code)
          addedCount++
        }
      }

      if (addedCount > 0) {
        syncTemplatesToForm()
        toast.add({
          title: t('admin.common.success'),
          description: `${addedCount} template(s) loaded`,
          color: 'success',
        })
      } else {
        toast.add({
          title: t('admin.common.info'),
          description: 'All default templates already exist',
          color: 'warning',
        })
      }
    } catch (error: any) {
      toast.add({
        title: t('admin.common.error'),
        description: error.data?.message || error.message || 'Failed to load default templates',
        color: 'error',
      })
    }
  }

  const testEmail = reactive({ to: '', templateCode: '' })
  const isSendingTest = ref(false)
  const testResult = ref<EmailTestResult | null>(null)

  async function sendTestEmail() {
    if (!testEmail.to || !testEmail.templateCode) {
      toast.add({
        title: t('admin.common.error'),
        description: t('admin.settings.email.test_fill_fields'),
        color: 'error',
      })
      return
    }

    isSendingTest.value = true
    testResult.value = null

    try {
      const result = await $fetch<EmailTestResult>('/api/admin/email/test', {
        method: 'POST',
        body: {
          to: testEmail.to,
          templateCode: testEmail.templateCode,
          templates: form.email_templates,
        },
      })
      testResult.value = result
    } catch (error: any) {
      testResult.value = {
        ok: false,
        error: error.data?.message || error.message,
      }
    } finally {
      isSendingTest.value = false
    }
  }

  return {
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
  }
}
