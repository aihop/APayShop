<template>
  <div class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
        <UIcon
          name="ph:browser-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">General Information</h2>
    </div>
    <div class="p-6 space-y-6">

      <UFormField
        label="Site Name"
        description="Used in headers and page titles"
      >
        <UInput
          v-model="form.site_name"
          placeholder="APayShop"
          icon="ph:text-t"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        label="Site URL"
        description="The primary domain URL of your site"
      >
        <UInput
          v-model="form.site_url"
          placeholder="https://apayshop.com"
          icon="ph:globe"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        label="Site Logo / Icon"
        description="URL to the site logo or SVG icon"
      >
        <div class="flex items-center gap-3 w-full">
          <UTextarea
            v-model="form.site_logo"
            placeholder="Enter the URL to your logo or SVG icon"
            icon="ph:image"
            size="md"
            class="flex-1"
            :ui="{ base: 'bg-[#09090b]' }"
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
            @click="() => logoInputRef?.click()"
          >
            Upload
          </UButton>
        </div>
      </UFormField>

      <UFormField
        label="Contact Email"
        description="Global support email for customers"
      >
        <UInput
          v-model="form.support_email"
          type="email"
          placeholder="support@example.com"
          icon="ph:envelope"
          size="md"
          class="w-full"
          :ui="{ base: 'bg-[#09090b]' }"
        />
      </UFormField>

      <UFormField
        label="Site Notice"
        description="Display an announcement at the top of the site"
      >
        <UTextarea
          v-model="form.site_notice"
          :rows="2"
          placeholder="Welcome to our new store!"
          class="w-full"
          :ui="{ base: 'bg-[#09090b]' }"
        />
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
        title: 'Success',
        description: 'Logo uploaded successfully',
        color: 'success',
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to upload logo',
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