<template>
  <UModal :open="Boolean(notice)" :dismissible="false" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <div class="p-6">
        <div class="flex items-start gap-4">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
            <UIcon name="ph:warning-circle-duotone" class="size-6" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ copy.title }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ copy.description }}</p>
          </div>
        </div>

        <dl class="mt-5 space-y-3 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900/70">
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">{{ copy.device }}</dt>
            <dd class="text-right font-medium text-gray-900 dark:text-white">{{ deviceLabel }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">{{ copy.time }}</dt>
            <dd class="text-right font-medium text-gray-900 dark:text-white">{{ loginTime }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">{{ copy.location }}</dt>
            <dd class="text-right font-medium text-gray-900 dark:text-white">{{ locationLabel }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">IP</dt>
            <dd class="font-mono text-right text-gray-900 dark:text-white">{{ notice?.ip || copy.unknown }}</dd>
          </div>
        </dl>

        <p class="mt-4 text-xs text-gray-500">{{ copy.securityHint }}</p>

        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="soft"
            icon="ph:shield-warning-duotone"
            :loading="handlingSecurityIncident"
            :disabled="handlingSecurityIncident"
            @click="goToSecurity"
          >
            {{ copy.notMe }}
          </UButton>
          <UButton color="primary" icon="ph:sign-in-duotone" @click="goToLogin">
            {{ copy.loginAgain }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const { notice, resetNotice } = useWebSessionMonitor()
const { logout } = useCustomerAuth()
const localePath = useLocalePath()
const handlingSecurityIncident = ref(false)

const isZh = computed(() => locale.value.toLowerCase().startsWith('zh'))
const copy = computed(() => isZh.value ? {
  title: '账号已在其他设备登录',
  description: '为保护账号安全，当前网页登录已退出。',
  device: '登录设备',
  time: '登录时间',
  location: '登录地区',
  unknown: '未知',
  securityHint: '如果这不是你本人操作，请立即重新登录并修改密码。',
  notMe: '不是我登录的',
  loginAgain: '在本设备重新登录',
} : {
  title: 'Signed in on another device',
  description: 'This web session was signed out to protect your account.',
  device: 'Device',
  time: 'Login time',
  location: 'Location',
  unknown: 'Unknown',
  securityHint: 'If this was not you, sign in again and change your password immediately.',
  notMe: 'This was not me',
  loginAgain: 'Sign in on this device',
})

const deviceTypeLabel = computed(() => {
  const type = notice.value?.deviceType
  if (!type) return ''
  if (!isZh.value) return type.charAt(0).toUpperCase() + type.slice(1)
  return type === 'mobile' ? '手机' : type === 'tablet' ? '平板' : '桌面端'
})
const deviceLabel = computed(() => [
  deviceTypeLabel.value,
  notice.value?.os,
  notice.value?.browser,
].filter(Boolean).join(' · ') || copy.value.unknown)
const locationLabel = computed(() => [
  notice.value?.country,
  notice.value?.region,
  notice.value?.city,
].filter(Boolean).join(' · ') || copy.value.unknown)
const loginTime = computed(() => {
  if (!notice.value?.loggedInAt) return copy.value.unknown
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(notice.value.loggedInAt))
})

const goToLogin = async (): Promise<void> => {
  resetNotice()
  await navigateTo(localePath('/auth/login'))
}
const goToSecurity = async (): Promise<void> => {
  if (handlingSecurityIncident.value) return
  handlingSecurityIncident.value = true
  try {
    await logout()
    resetNotice()
    await navigateTo(localePath('/auth/forgot-password'))
  } finally {
    handlingSecurityIncident.value = false
  }
}
</script>
