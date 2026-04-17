<template>
  <div class="h-full flex flex-col max-w-2xl mx-auto w-full">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.profile.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.profile.subtitle') }}</p>
      </div>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl p-8">
      <form
        @submit.prevent="updatePassword"
        class="space-y-6"
      >
        <UFormField :label="$t('admin.profile.username')">
          <UInput
            modelValue="admin"
            disabled
            class="text-gray-500 opacity-70 w-full"
            icon="ph:user"
          />
        </UFormField>

        <UFormField :label="$t('admin.profile.currentPassword')">
          <UInput
            v-model="form.oldPassword"
            type="password"
            required
            class="text-white w-full"
            icon="ph:lock-key"
          />
        </UFormField>

        <UFormField :label="$t('admin.profile.newPassword')">
          <UInput
            v-model="form.newPassword"
            type="password"
            required
            class="text-white w-full"
            icon="ph:lock-key-open"
          />
        </UFormField>

        <UFormField :label="$t('admin.profile.confirmPassword')">
          <UInput
            v-model="form.confirmPassword"
            type="password"
            required
            class="text-white w-full"
            icon="ph:lock-key-open"
          />
        </UFormField>

        <div class="pt-4 border-t border-gray-800/50 flex justify-end">
          <UButton
            type="submit"
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white px-8"
            :loading="isSaving"
            :disabled="!isFormValid"
          >
            {{ $t('admin.profile.save') }}
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

const { t } = useI18n()

definePageMeta({ title: 'Profile Settings' })

const toast = useToast()
const isSaving = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const isFormValid = computed(() => {
  return (
    form.oldPassword &&
    form.newPassword &&
    form.confirmPassword &&
    form.newPassword === form.confirmPassword &&
    form.newPassword.length >= 6
  )
})

const updatePassword = async () => {
  if (form.newPassword !== form.confirmPassword) {
    toast.add({
      title: 'Error',
      description: t('admin.profile.passwordMismatch'),
      color: 'error',
    })
    return
  }

  isSaving.value = true
  try {
    const res: any = await $fetch('/api/admin/profile', {
      method: 'PUT',
      body: {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      },
    })

    if (res && res.code === 0) {
      toast.add({
        title: 'Success',
        description: t('admin.profile.success'),
        color: 'success',
      })

      form.oldPassword = ''
      form.newPassword = ''
      form.confirmPassword = ''

      setTimeout(() => {
        useRouter().push('/admin/login')
      }, 1500)
    } else {
      throw new Error(res?.message || 'Failed to update password')
    }
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.message || e.data?.message || 'Failed to update password',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>
