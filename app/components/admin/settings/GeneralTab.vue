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
        :description="$t('admin.settings.general.site_name_desc')"
      >
        <UInput
          v-model="form.site_name"
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
import { ref } from 'vue'

const props = defineProps<{
  form: any
}>()

const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)

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
        title: $t('admin.settings.general.toast_success'),
        description: $t('admin.settings.general.toast_logo_uploaded'),
        color: 'success',
      })
    }
  } catch (error: any) {
    toast.add({
      title: $t('admin.settings.general.toast_error'),
      description: error.data?.message || $t('admin.settings.general.toast_upload_failed'),
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
