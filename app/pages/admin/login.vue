<template>
  <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black selection:bg-white selection:text-black">
    <!-- Abstract Background -->
    <div class="absolute inset-0 pointer-events-none">
      <div
        class="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity grayscale"
        :style="backgroundStyle"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
    </div>

    <div class="w-full max-w-md relative z-10">

      <!-- Login Card -->
      <div class="bg-black/40 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl relative overflow-hidden group">
        <!-- Interactive gradient highlight on hover -->
        <div class="absolute -inset-24 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-2xl"></div>

        <div class="mb-10 text-center relative z-10">
          <h1 class="text-3xl font-medium tracking-tight text-white mb-2">{{ welcomeText }}</h1>
          <p class="text-gray-400 text-sm">Please enter your details to sign in.</p>
        </div>

        <div
          v-if="route.query.setup === 'success'"
          class="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm flex items-center gap-3 relative z-10"
        >
          <UIcon
            name="ph:check-circle-fill"
            class="w-5 h-5"
          />
          Setup complete. You can now sign in.
        </div>

        <form
          @submit.prevent="handleLogin"
          class="space-y-6 relative z-10"
        >
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300 block">Username</label>
            <div class="relative">
              <input
                v-model="form.username"
                type="text"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between items-center">
              <label class="text-sm font-medium text-gray-300 block">Password</label>
            </div>
            <div class="relative">
              <input
                v-model="form.password"
                type="password"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            class="w-full bg-white text-black font-medium py-3.5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading"
          >
            <UIcon
              v-if="isLoading"
              name="ph:spinner-gap-bold"
              class="w-5 h-5 animate-spin"
            />
            <span v-else>Sign In</span>
            <UIcon
              v-if="!isLoading"
              name="ph:arrow-right-bold"
              class="w-4 h-4"
            />
          </button>
        </form>

        <div
          v-if="errorMsg"
          class="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-center gap-2 relative z-10"
        >
          <UIcon
            name="ph:warning-circle-fill"
            class="w-5 h-5 shrink-0"
          />
          {{ errorMsg }}
        </div>
      </div>

      <!-- Footer text -->
      <div class="text-center mt-12 text-gray-600 text-xs font-medium tracking-wide">
        SECURE ADMIN PORTAL &copy; {{ new Date().getFullYear() }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { settings, fetchSettings, getSetting } = useSettings()

definePageMeta({
  layout: false, // Use no layout to take full screen control
})

const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
})
const isLoading = ref(false)
const errorMsg = ref('')

// Computed properties for customization
const welcomeText = computed(() => {
  return 'Welcome back'
})

const backgroundStyle = computed(() => {
  return {
    backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
  }
})

const handleLogin = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    const res: any = await $fetch('/api/admin/login', {
      method: 'POST',
      body: form,
    })

    // Redirect to dashboard
    router.push('/admin')
  } catch (e: any) {
    errorMsg.value = e.data?.message || 'Invalid credentials'
  } finally {
    isLoading.value = false
  }
}
</script>