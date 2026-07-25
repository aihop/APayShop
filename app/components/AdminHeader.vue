<template>
  <header class="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur dark:border-gray-800/50 dark:bg-[#09090b]/80">
    <div class="max-w-[1440px] w-full px-6 lg:px-12 mx-auto h-16 flex items-center justify-between">
      <div class="flex items-center gap-8">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 mr-6"
        >
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center p-1.5">
            <SiteLogo
              :logo-data="getSetting('site_logo')"
              :alt="getSetting('site_name')"
              icon-color="white"
            />
          </div>
          <span class="font-extrabold tracking-wide text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            {{ getSetting('site_name') }}
          </span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          <RouteSearch />
          <NuxtLink
            to="https://apay.run/docs"
            target="_blank"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >{{ $t('admin.nav.docs') }}</NuxtLink>
        </nav>
      </div>

      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-3">
          <LanguageSwitcher
            :current-locale="locale"
            :locales="locales"
            :show-text="true"
            @switch="switchLocale"
          />

          <UButton
            color="primary"
            variant="outline"
            class="rounded-full font-medium px-6 py-1.5 hidden md:flex shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            to="/"
            target="_blank"
          >
            {{ $t('admin.header.viewStore') }}
          </UButton>
          <ClientOnly>
            <UButton
              color="neutral"
              variant="ghost"
              :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
              class="rounded-full"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleColorMode"
            />
          </ClientOnly>
          <div class="hidden md:flex">
            <ClientOnly>
              <UDropdownMenu
                :items="userMenuItems"
                :ui="{ content: 'w-48' }"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 p-0 text-sm font-bold text-purple-600 transition-colors hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30"
                >
                  A
                </UButton>
              </UDropdownMenu>
            </ClientOnly>
          </div>
        </div>
        <ClientOnly>
          <UButton
            color="neutral"
            variant="ghost"
            :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
            class="md:hidden"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleColorMode"
          />
        </ClientOnly>
        <UButton
          color="neutral"
          variant="ghost"
          icon="ph:list-bold"
          class="md:hidden"
          @click="$emit('open-mobile-menu')"
        />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// 后台专属头部,由 layouts/admin.vue 独占挂载。
// 2026-07 从 AppHeader 的 isAdminRoute 分支拆出:前台商城头与后台头
// 此前混在一个组件里靠 v-if 切换,互相牵制;拆分后两侧各自演进。
const { getSetting } = useSettings()
const { locale, locales, t } = useI18n()
const colorMode = useColorMode()

defineEmits(['open-mobile-menu'])

const isDark = computed(() => colorMode.value === 'dark')

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const switchLocale = async (newLocale: 'en' | 'zh') => {
  locale.value = newLocale

  if (typeof document !== 'undefined') {
    document.cookie = `i18n_redirected=${newLocale}; path=/; max-age=31536000`
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', newLocale)
    // admin 路由不带 i18n URL 前缀,切语言只能整页刷新让 SSR 重取
    setTimeout(() => {
      window.location.reload()
    }, 50)
  }
}

const logout = async () => {
  await $fetch('/api/admin/logout', {
    method: 'POST',
  })
  navigateTo('/admin/login')
}

const userMenuItems = computed(() => [
  [
    {
      label: t('admin.nav.profile'),
      icon: 'ph:user',
      onSelect: () => navigateTo('/admin/profile'),
    },
  ],
  [
    {
      label: t('admin.header.logout'),
      icon: 'ph:sign-out',
      onSelect: logout,
    },
  ],
])
</script>
