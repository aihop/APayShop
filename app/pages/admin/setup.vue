<template>
  <div class="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
          <Icon
            name="ph:rocket-launch-fill"
            class="text-white w-6 h-6"
          />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">System Setup</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Create your first administrator account</p>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>

        <form
          v-if="!redirecting"
          @submit.prevent="handleSetup"
          class="space-y-6"
        >
          <UFormField
            label="Admin Username"
            :description="usernameHint"
            :error="usernameError"
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
            :description="passwordHint"
            :error="passwordError"
          >
            <UInput
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              size="lg"
              :icon="showPassword ? 'ph:eye' : 'ph:eye-slash'"
              :trailing-icon="showPassword ? 'ph:eye-slash' : 'ph:eye'"
              class="text-white"
              required
              @click:icon="showPassword = !showPassword"
              @click:trailing="showPassword = !showPassword"
            />
          </UFormField>

          <div v-if="form.password" class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500 dark:text-gray-400">Password strength</span>
              <span :class="strengthLabelClass">{{ strengthLabel }}</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-gray-200/70 dark:bg-gray-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-200"
                :class="strengthBarClass"
                :style="{ width: strengthPercent + '%' }"
              />
            </div>
            <ul class="space-y-1 text-xs pt-1">
              <li
                v-for="(rule, idx) in rules"
                :key="idx"
                class="flex items-center gap-2"
                :class="rule.pass ? 'text-emerald-500' : 'text-gray-500 dark:text-gray-400'"
              >
                <Icon :name="rule.pass ? 'ph:check-circle-fill' : 'ph:circle'" class="w-3.5 h-3.5 shrink-0" />
                <span>{{ rule.label }}</span>
              </li>
            </ul>
          </div>

          <UButton
            type="submit"
            color="primary"
            size="xl"
            block
            class="mt-8 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all text-white bg-purple-600 hover:bg-purple-500"
            :loading="isLoading"
            :disabled="!canSubmit"
          >
            Initialize System
          </UButton>
        </form>

        <div v-else class="py-12 text-center">
          <Icon name="ph:spinner-gap" class="w-8 h-8 mx-auto animate-spin text-purple-500" />
          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Redirecting…</p>
        </div>

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
  layout: false,
})

const MIN_PASSWORD_LEN = 10
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,32}$/

const router = useRouter()
const form = reactive({
  username: '',
  password: '',
})
const isLoading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)
const redirecting = ref(false)

const usernameError = computed(() => {
  if (!form.username) return ''
  const trimmed = form.username.trim()
  if (!USERNAME_REGEX.test(trimmed)) {
    return '3-32 chars, letters / digits / _ . - only'
  }
  return ''
})

const usernameHint = computed(() =>
  usernameError.value
    ? ''
    : '3-32 chars: letters, numbers, underscore, dot or hyphen'
)

const rules = computed(() => {
  const pw = form.password
  return [
    {
      label: `At least ${MIN_PASSWORD_LEN} characters`,
      pass: pw.length >= MIN_PASSWORD_LEN,
    },
    {
      label: 'Contains uppercase letter (A-Z)',
      pass: /[A-Z]/.test(pw),
    },
    {
      label: 'Contains lowercase letter (a-z)',
      pass: /[a-z]/.test(pw),
    },
    {
      label: 'Contains digit (0-9)',
      pass: /\d/.test(pw),
    },
    {
      label: 'At least 2 character classes combined',
      pass: (() => {
        const variety = [/[a-z]/.test(pw), /[A-Z]/.test(pw), /\d/.test(pw)].filter(Boolean).length
        return variety >= 2
      })(),
    },
  ]
})

const strengthScore = computed(() => rules.value.filter(r => r.pass).length)
const strengthPercent = computed(() => (strengthScore.value / rules.value.length) * 100)
const strengthLabel = computed(() => {
  if (!form.password) return '—'
  const s = strengthScore.value
  if (s <= 2) return 'Weak'
  if (s <= 3) return 'Fair'
  if (s <= 4) return 'Good'
  return 'Strong'
})
const strengthLabelClass = computed(() => {
  const s = strengthScore.value
  if (!form.password) return 'text-gray-400'
  if (s <= 2) return 'text-red-500'
  if (s <= 3) return 'text-amber-500'
  if (s <= 4) return 'text-sky-500'
  return 'text-emerald-500'
})
const strengthBarClass = computed(() => {
  const s = strengthScore.value
  if (!form.password) return 'bg-gray-400'
  if (s <= 2) return 'bg-red-500'
  if (s <= 3) return 'bg-amber-500'
  if (s <= 4) return 'bg-sky-500'
  return 'bg-emerald-500'
})

const passwordError = computed(() => {
  if (!form.password) return ''
  const firstFail = rules.value.find(r => !r.pass)
  return firstFail ? `Not met: ${firstFail.label}` : ''
})

const passwordHint = computed(() =>
  passwordError.value
    ? ''
    : `${MIN_PASSWORD_LEN}+ chars with 2+ of lowercase / uppercase / digit`
)

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (!form.username.trim() || !form.password) return false
  if (usernameError.value || passwordError.value) return false
  return true
})

async function checkInitializedAndRedirect() {
  try {
    const res = await $fetch<{ initialized: boolean }>('/api/admin/setup/check', {
      method: 'GET',
    })
    if (res?.initialized) {
      redirecting.value = true
      await router.replace('/admin/login')
    }
  } catch (e) {
    // 网络或限流失败时不阻塞，等提交时后端会再兜底
  }
}

onMounted(() => {
  checkInitializedAndRedirect()
})

const handleSetup = async () => {
  if (!canSubmit.value) {
    errorMsg.value = passwordError.value || usernameError.value || 'Please complete the form'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/admin/setup', {
      method: 'POST',
      body: {
        username: form.username.trim(),
        password: form.password,
      },
    })

    router.push('/admin/login?setup=success')
  } catch (e: any) {
    if (e?.status === 403) {
      redirecting.value = true
      errorMsg.value = e.data?.message || 'Admin already initialized. Redirecting…'
      setTimeout(() => router.replace('/admin/login'), 800)
      return
    }
    errorMsg.value =
      e.data?.message ||
      'Failed to initialize system. The admin might already exist.'
  } finally {
    isLoading.value = false
  }
}
</script>
