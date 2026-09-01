<template>
  <header class="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur dark:border-gray-800/50 dark:bg-[#09090b]/80">
    <!-- 全宽不限 1440:侧栏 fixed 贴边后,顶栏内容再居中限宽会在超宽屏上与侧栏左缘错位 -->
    <div class="w-full px-4 md:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-8">
        <NuxtLink
          to="/"
          class="group flex items-center gap-2.5 mr-6"
        >
          <div
            v-if="getSetting('site_logo')"
            class="w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
          >
            <SiteLogo
              :logo-data="getSetting('site_logo')"
              :alt="getLocalizedSetting('site_name')"
            />
          </div>
          <span class="relative inline-flex items-center font-bold tracking-tight text-lg sm:text-xl">
            <span class="absolute -inset-x-1.5 -inset-y-0.5 rounded-lg bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-cyan-500/15 blur-sm opacity-0 group-hover:opacity-100 dark:opacity-40 dark:animate-pulse transition-opacity duration-700 pointer-events-none"></span>
            <span class="relative bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-200 dark:to-indigo-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] transition-all duration-300">
              {{ getLocalizedSetting('site_name') }}
            </span>
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
const { getLocalizedSetting } = useLocalizedSettings()
const { locale, locales, t } = useI18n()
const colorMode = useColorMode()
// Resolved here, in the synchronous setup context. Calling this inside the
// async logout() — i.e. after an `await` — loses the component instance, and
// useAdminPermissions() reaches useI18n(), which throws "Must be called at the
// top of a `setup` function" there. That threw before navigateTo() ran, which
// is why logging out left you sitting on the same page.
const { resetAdmin } = useAdminSession()

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
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
  } catch (e) {
    // A failed logout request must not strand the user in a half-logged-out
    // admin UI — clear local state and leave anyway.
    console.error('[admin-logout] request failed:', e)
  }
  // Without this, the shared admin state (and therefore every hasPerm()
  // check across the app) keeps showing this account's permissions until a
  // hard refresh — including to whoever logs in next in this same tab.
  resetAdmin()
  await navigateTo('/admin/login')
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
