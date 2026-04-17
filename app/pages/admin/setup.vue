<template>
  <div class="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
          <Icon
            name="ph:rocket-launch-fill"
            class="text-white w-6 h-6"
          />
        </div>
        <h1 class="text-3xl font-bold text-white tracking-tight">System Setup</h1>
        <p class="text-gray-400 mt-2">Create your first administrator account</p>
      </div>

      <div class="bg-[#121214] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>

        <form
          @submit.prevent="handleSetup"
          class="space-y-6"
        >
          <UFormField
            label="Admin Username"
            description="Choose a unique username for login"
          >
            <UInput
              v-model="form.username"
              placeholder="admin"
              size="lg"
              icon="ph:user"
              class="text-white"
              required
            />
          </UFormField>

          <UFormField
            label="Password"
            description="Must be at least 6 characters"
          >
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              size="lg"
              icon="ph:lock-key"
              class="text-white"
              required
            />
          </UFormField>

          <UButton
            type="submit"
            color="primary"
            size="xl"
            block
            class="mt-8 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all text-white bg-purple-600 hover:bg-purple-500"
            :loading="isLoading"
          >
            Initialize System
          </UButton>
        </form>

        <div
          v-if="errorMsg"
          class="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"
        >
          {{ errorMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false, // Don't use the admin layout for setup page
})

const router = useRouter()
const form = reactive({
  username: '',
  password: '',
})
const isLoading = ref(false)
const errorMsg = ref('')

const handleSetup = async () => {
  if (form.password.length < 6) {
    errorMsg.value = 'Password must be at least 6 characters'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/admin/setup', {
      method: 'POST',
      body: form,
    })

    // Automatically redirect to login page after successful setup
    router.push('/admin/login?setup=success')
  } catch (e: any) {
    errorMsg.value =
      e.data?.message ||
      'Failed to initialize system. The admin might already exist.'
  } finally {
    isLoading.value = false
  }
}
</script>