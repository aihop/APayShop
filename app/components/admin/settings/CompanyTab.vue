<template>
  <div class="bg-[#121214] border border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-800/60 bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
        <UIcon
          name="ph:buildings-fill"
          class="w-5 h-5"
        />
      </div>
      <h2 class="text-lg font-semibold text-white">Company Information</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UFormField label="Company Name">
          <UInput
            v-model="form.company_name"
            placeholder="Your Company Ltd."
            icon="ph:briefcase"
            size="md"
            :ui="{ base: 'bg-[#09090b]' }"
          />
        </UFormField>

        <UFormField label="Company Phone">
          <UInput
            v-model="form.company_phone"
            placeholder="+1 (555) 123-4567"
            icon="ph:phone"
            size="md"
            :ui="{ base: 'bg-[#09090b]' }"
          />
        </UFormField>
      </div>

      <UFormField label="Company Address">
        <UTextarea
          v-model="form.company_address"
          :rows="3"
          class="w-full"
          placeholder="123 Business St, City, Country"
          :ui="{ base: 'bg-[#09090b]' }"
        />
      </UFormField>

      <div class="pt-2 border-t border-gray-800/60">
        <h3 class="text-sm font-medium text-gray-300 mb-6">Social & Messaging</h3>
        <div class="space-y-6">
          <!-- WeChat -->
          <div class="bg-[#18181b] border border-gray-800/40 rounded-xl p-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                <UIcon
                  name="ph:wechat-logo"
                  class="w-5 h-5"
                />
              </div>
              <h4 class="text-base font-medium text-white">WeChat</h4>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="WeChat ID">
                <UInput
                  v-model="form.wechat"
                  placeholder="Enter WeChat ID"
                  icon="ph:identification-badge"
                  size="md"
                  class="w-full"
                  :ui="{ base: 'bg-[#09090b]' }"
                />
              </UFormField>
              <UFormField label="QR Code">
                <div class="flex items-center gap-2 w-full">
                  <UInput
                    v-model="form.wechat_qr"
                    placeholder="QR Code URL"
                    icon="ph:qr-code"
                    size="md"
                    class="flex-1"
                    :ui="{ base: 'bg-[#09090b]' }"
                  />
                  <input
                    type="file"
                    ref="wechatQrInputRef"
                    class="hidden"
                    accept="image/*"
                    @change="(e) => uploadQr(e, 'wechat_qr', wechatQrInputRef)"
                  />
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="ph:upload-simple"
                    :loading="isUploading.wechat_qr"
                    @click="() => wechatQrInputRef?.click()"
                  />
                </div>
              </UFormField>
            </div>
          </div>

          <!-- WhatsApp -->
          <div class="bg-[#18181b] border border-gray-800/40 rounded-xl p-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UIcon
                  name="ph:whatsapp-logo"
                  class="w-5 h-5"
                />
              </div>
              <h4 class="text-base font-medium text-white">WhatsApp</h4>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Number or Link">
                <UInput
                  v-model="form.whatsapp"
                  placeholder="Enter WhatsApp Number or Link"
                  icon="ph:phone"
                  size="md"
                  class="w-full"
                  :ui="{ base: 'bg-[#09090b]' }"
                />
              </UFormField>
              <UFormField label="QR Code">
                <div class="flex items-center gap-2 w-full">
                  <UInput
                    v-model="form.whatsapp_qr"
                    placeholder="QR Code URL"
                    icon="ph:qr-code"
                    size="md"
                    class="flex-1"
                    :ui="{ base: 'bg-[#09090b]' }"
                  />
                  <input
                    type="file"
                    ref="whatsappQrInputRef"
                    class="hidden"
                    accept="image/*"
                    @change="(e) => uploadQr(e, 'whatsapp_qr', whatsappQrInputRef)"
                  />
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="ph:upload-simple"
                    :loading="isUploading.whatsapp_qr"
                    @click="() => whatsappQrInputRef?.click()"
                  />
                </div>
              </UFormField>
            </div>
          </div>

          <!-- Telegram -->
          <div class="bg-[#18181b] border border-gray-800/40 rounded-xl p-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                <UIcon
                  name="ph:telegram-logo"
                  class="w-5 h-5"
                />
              </div>
              <h4 class="text-base font-medium text-white">Telegram</h4>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UFormField label="Username or Link">
                <UInput
                  v-model="form.telegram"
                  placeholder="Enter @username or Link"
                  icon="ph:at"
                  size="md"
                  class="w-full"
                  :ui="{ base: 'bg-[#09090b]' }"
                />
              </UFormField>
              <UFormField label="QR Code">
                <div class="flex items-center gap-2 w-full">
                  <UInput
                    v-model="form.telegram_qr"
                    placeholder="QR Code URL"
                    icon="ph:qr-code"
                    size="md"
                    class="flex-1"
                    :ui="{ base: 'bg-[#09090b]' }"
                  />
                  <input
                    type="file"
                    ref="telegramQrInputRef"
                    class="hidden"
                    accept="image/*"
                    @change="(e) => uploadQr(e, 'telegram_qr', telegramQrInputRef)"
                  />
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="ph:upload-simple"
                    :loading="isUploading.telegram_qr"
                    @click="() => telegramQrInputRef?.click()"
                  />
                </div>
              </UFormField>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '#imports'

const props = defineProps<{
  form: any
}>()

const toast = useToast()

const wechatQrInputRef = ref<HTMLInputElement | null>(null)
const whatsappQrInputRef = ref<HTMLInputElement | null>(null)
const telegramQrInputRef = ref<HTMLInputElement | null>(null)

const isUploading = ref<Record<string, boolean>>({
  wechat_qr: false,
  whatsapp_qr: false,
  telegram_qr: false,
})

const uploadQr = async (event: Event, field: string, inputRef: any) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  isUploading.value[field] = true
  try {
    const res: any = await $fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.url) {
      props.form[field] = res.url
      toast.add({
        title: 'Success',
        description: 'QR Code uploaded successfully',
        color: 'success',
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to upload QR code',
      color: 'error',
    })
  } finally {
    isUploading.value[field] = false
    if (inputRef && inputRef.value) {
      inputRef.value.value = ''
    }
  }
}
</script>