<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
        <UIcon
          name="ph:browser-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.general.title') }}</h2>
    </div>
    <div class="p-6 space-y-6">
      <UFormField
        :label="$t('admin.settings.general.site_name')"
        :description="$t('admin.settings.general.site_name_locale_desc', { locale: activeLocale })"
      >
        <div class="mb-3 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="localeOption in supportedLocales"
            :key="localeOption.code"
            type="button"
            :class="[
              'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              activeLocale === localeOption.code
                ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white',
            ]"
            @click="activeLocale = localeOption.code"
          >
            <UIcon
              :name="localeOption.code === defaultLocale ? 'ph:star-fill' : 'ph:translate'"
              :class="['h-4 w-4', localeOption.code === defaultLocale ? 'text-yellow-500' : '']"
            />
            {{ localeOption.name }} ({{ localeOption.code }})
          </button>
        </div>
        <UInput
          v-model="form[getSiteNameKey(activeLocale)]"
          placeholder="APay"
          icon="ph:text-t"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.site_url')"
        :description="$t('admin.settings.general.site_url_desc')"
      >
        <UInput
          v-model="form.site_url"
          placeholder="https://apay.run"
          icon="ph:globe"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.site_logo')"
        :description="$t('admin.settings.general.site_logo_desc')"
      >
        <div class="flex items-center gap-3 w-full">
          <UTextarea
            v-model="form.site_logo"
            placeholder="Enter the URL to your logo or SVG icon"
            icon="ph:image"
            size="md"
            class="flex-1"
            :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
          />
          <input
            type="file"
            ref="logoInputRef"
            class="hidden"
            accept="image/*"
            @change="uploadLogo"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="ph:upload-simple"
            :loading="isUploadingLogo"
            :disabled="!hasAdminPerm('settings:edit')"
            @click="() => logoInputRef?.click()"
          >
            {{ $t('admin.settings.general.upload') }}
          </UButton>
        </div>
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.contact_email')"
        :description="$t('admin.settings.general.contact_email_desc')"
      >
        <UInput
          v-model="form.support_email"
          type="email"
          placeholder="support@example.com"
          icon="ph:envelope"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.site_notice')"
        :description="$t('admin.settings.general.site_notice_desc')"
      >
        <UTextarea
          v-model="form.site_notice"
          :rows="2"
          placeholder="Welcome to our new store!"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.footer_copyright')"
        :description="$t('admin.settings.general.footer_copyright_desc')"
      >
        <UInput
          v-model="form.footer_copyright"
          placeholder="© 2026 APay.run. All rights reserved."
          icon="ph:copyright"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-gray-50 dark:bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        :label="$t('admin.settings.general.disable_multi_device_login')"
        :description="$t('admin.settings.general.disable_multi_device_login_desc')"
      >
        <div class="flex items-center gap-3">
          <USwitch
            v-model="form.disable_multi_device_login"
          />
          <span
            v-if="form.disable_multi_device_login"
            class="text-sm text-orange-600 dark:text-orange-400"
          >
            {{ $t('admin.settings.general.multi_device_login_warning') }}
          </span>
          <span
            v-else
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ $t('admin.settings.general.multi_device_login_allowed') }}
          </span>
        </div>
      </UFormField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()

const props = defineProps<{
  form: any
}>()

const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)

const allLocales = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
]

const supportedLocales = computed(() => {
  const codes = String(props.form.supported_locales || 'en')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)

  return codes.map((code) => {
    return allLocales.find(locale => locale.code === code) || { code, name: code.toUpperCase() }
  })
})

const defaultLocale = computed(() => String(props.form.default_locale || 'en'))
const activeLocale = ref(defaultLocale.value)

const getSiteNameKey = (localeCode: string) => {
  return localeCode === 'en' ? 'site_name' : `${localeCode.replaceAll('-', '_')}_site_name`
}

watch(
  supportedLocales,
  (locales) => {
    if (!locales.some(locale => locale.code === activeLocale.value)) {
      activeLocale.value = locales.some(locale => locale.code === defaultLocale.value)
        ? defaultLocale.value
        : locales[0]?.code || 'en'
    }

    for (const locale of locales) {
      const key = getSiteNameKey(locale.code)
      if (!(key in props.form)) props.form[key] = ''
    }
  },
  { immediate: true, deep: true },
)

const uploadLogo = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  isUploadingLogo.value = true
  try {
    const res: any = await $fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.url) {
      props.form.site_logo = res.url
      toast.add({
        title: t('admin.settings.general.toast_success'),
        description: t('admin.settings.general.toast_logo_uploaded'),
        color: 'success',
      })
    }
  } catch (error: any) {
    toast.add({
      title: t('admin.settings.general.toast_error'),
      description: error.data?.message || t('admin.settings.general.toast_upload_failed'),
      color: 'error',
    })
  } finally {
    isUploadingLogo.value = false
    if (logoInputRef.value) {
      logoInputRef.value.value = ''
    }
  }
}
</script>
