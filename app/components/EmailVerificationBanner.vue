<template>
  <div>
    <!-- 1. 软提示模式 (Banner Mode): 顶部轻量极简提醒条 -->
    <div
      v-if="showSoftBanner"
      class="w-full bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/20 dark:border-amber-800/40 px-4 py-2 transition-all duration-300 relative z-30"
    >
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium truncate">
          <UIcon
            name="ph:envelope-simple-fill"
            class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <span class="truncate">
            {{ $t('site.auth.email_verification.banner_unverified') }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <UButton
            size="xs"
            color="warning"
            variant="soft"
            class="rounded-lg font-medium shadow-xs text-xs"
            :loading="isSending"
            :disabled="cooldown > 0"
            @click="resendEmail"
          >
            <template #leading>
              <UIcon name="ph:paper-plane-tilt-bold" class="w-3.5 h-3.5" />
            </template>
            <span>
              {{ cooldown > 0
                ? $t('site.auth.email_verification.resend_cooldown', { seconds: cooldown })
                : (isSending ? $t('site.auth.email_verification.resending') : $t('site.auth.email_verification.resend_btn'))
              }}
            </span>
          </UButton>
        </div>
      </div>
    </div>

    <!-- 2. 强制拦截模式 (Strict Mode): 优雅的全屏居中遮罩弹窗 -->
    <div
      v-if="showStrictModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/10 dark:bg-black/55 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md bg-white dark:bg-[#121214] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden p-6 sm:p-8 text-center space-y-6 animate-scale-in"
      >
        <!-- 图标区域 -->
        <div class="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
          <UIcon name="ph:envelope-open-duotone" class="w-8 h-8" />
        </div>

        <!-- 标题与说明 -->
        <div class="space-y-2">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {{ $t('site.auth.email_verification.strict_modal_title') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {{ $t('site.auth.email_verification.strict_modal_desc') }}
          </p>
          <div v-if="userEmail" class="inline-block mt-2 px-3 py-1 bg-gray-100 dark:bg-gray-800/80 rounded-full text-xs font-mono text-gray-700 dark:text-gray-300">
            {{ userEmail }}
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div class="space-y-3 pt-2">
          <!-- 重新发送验证邮件 -->
          <UButton
            block
            size="lg"
            color="primary"
            class="rounded-xl font-semibold shadow-md py-3"
            :loading="isSending"
            :disabled="cooldown > 0"
            @click="resendEmail"
          >
            <template #leading>
              <UIcon name="ph:paper-plane-tilt-bold" class="w-4 h-4" />
            </template>
            <span>
              {{ cooldown > 0
                ? $t('site.auth.email_verification.resend_cooldown', { seconds: cooldown })
                : (isSending ? $t('site.auth.email_verification.resending') : $t('site.auth.email_verification.resend_btn'))
              }}
            </span>
          </UButton>

          <!-- 刷新验证状态 -->
          <UButton
            block
            size="lg"
            color="neutral"
            variant="soft"
            class="rounded-xl font-semibold py-3"
            :loading="isRefreshing"
            @click="refreshVerificationStatus"
          >
            <template #leading>
              <UIcon name="ph:arrow-clockwise-bold" class="w-4 h-4" />
            </template>
            <span>{{ $t('site.auth.email_verification.refresh_status') }}</span>
          </UButton>
        </div>

        <!-- 底部安全退出 -->
        <div class="pt-2 border-t border-gray-100 dark:border-gray-800/80">
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            :disabled="isLoggingOut"
            @click="handleLogout"
          >
            <UIcon name="ph:sign-out" class="w-3.5 h-3.5" />
            <span>{{ $t('site.auth.email_verification.logout_btn') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

const { user, loggedIn, ready, fetch, clear } = useUserSession()
const { getSetting } = useSettings()
const toast = useToast()
const { t } = useI18n()
const { localePath } = useLocaleRouter()

const isSending = ref(false)
const isRefreshing = ref(false)
const isLoggingOut = ref(false)
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const policy = computed(() => {
  return getSetting('email_verify_policy') || 'banner'
})

// 判断用户是否已完成邮箱验证
const isVerified = computed(() => {
  if (!user.value) return true
  const u = user.value as any
  return Boolean(u.emailVerifiedAt || u.emailVerified)
})

const userEmail = computed(() => {
  return (user.value as any)?.email || ''
})

// 控制软提示横幅展示
const showSoftBanner = computed(() => {
  if (!ready.value || !loggedIn.value || !user.value) return false
  if (policy.value !== 'banner') return false
  return !isVerified.value
})

// 控制强制弹窗展示
const showStrictModal = computed(() => {
  if (!ready.value || !loggedIn.value || !user.value) return false
  if (policy.value !== 'strict') return false
  return !isVerified.value
})

const startCooldown = (seconds = 60) => {
  cooldown.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (cooldown.value > 0) {
      cooldown.value--
    } else {
      if (timer) clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const resendEmail = async () => {
  if (cooldown.value > 0 || isSending.value) return

  isSending.value = true
  try {
    const res: any = await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: {
        email: userEmail.value,
      },
    })

    if (res?.alreadyVerified) {
      toast.add({
        title: t('site.auth.email_verification.already_verified'),
        color: 'success',
      })
      await fetch()
      return
    }

    startCooldown(res?.cooldownSeconds || 60)
    toast.add({
      title: t('site.auth.email_verification.toast_sent_title'),
      description: t('site.auth.email_verification.toast_sent_desc', { email: userEmail.value }),
      color: 'success',
    })
  } catch (err: any) {
    const errMsg = err?.data?.message || err?.message || t('site.auth.email_verification.toast_failed')
    toast.add({
      title: t('common.error'),
      description: errMsg,
      color: 'error',
    })
  } finally {
    isSending.value = false
  }
}

// 刷新验证状态
const refreshVerificationStatus = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const res: any = await $fetch('/api/auth/me')
    await fetch()
    const verified = Boolean(res?.user?.emailVerified || res?.user?.emailVerifiedAt || isVerified.value)
    if (verified) {
      toast.add({
        title: t('site.auth.email_verification.verified_success'),
        color: 'success',
      })
    } else {
      toast.add({
        title: t('site.auth.email_verification.still_unverified'),
        color: 'warning',
      })
    }
  } catch {
    toast.add({
      title: t('site.auth.email_verification.still_unverified'),
      color: 'warning',
    })
  } finally {
    isRefreshing.value = false
  }
}

// 静默自动检测验证状态（页面加载、刷新、或用户切回当前标签页时自动同步）
const checkSilentVerification = async (showToastOnSuccess = false) => {
  if (!loggedIn.value || !user.value || isVerified.value || isRefreshing.value) return
  try {
    const res: any = await $fetch('/api/auth/me')
    const verified = Boolean(res?.user?.emailVerified || res?.user?.emailVerifiedAt)
    if (verified) {
      await fetch()
      if (showToastOnSuccess) {
        toast.add({
          title: t('site.auth.email_verification.verified_success'),
          color: 'success',
        })
      }
    }
  } catch {
    // 静默失败，不打扰用户
  }
}

onMounted(() => {
  // 1. 页面加载/刷新时自动同步一次最新验证状态
  if (loggedIn.value && !isVerified.value) {
    checkSilentVerification(false)
  }

  // 2. 当用户在外部邮箱点击链接后切回本页面标签时，自动感知并解锁
  const handleVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible' && loggedIn.value && !isVerified.value) {
      checkSilentVerification(true)
    }
  }

  window.addEventListener('focus', handleVisibilityOrFocus)
  document.addEventListener('visibilitychange', handleVisibilityOrFocus)

  onUnmounted(() => {
    window.removeEventListener('focus', handleVisibilityOrFocus)
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
  })
})

// 退出登录
const handleLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clear().catch(() => {})
    toast.add({
      title: t('site.auth.email_verification.logout_btn'),
      color: 'info',
    })
    await navigateTo(localePath('/auth/login'))
  } finally {
    isLoggingOut.value = false
  }
}
</script>
