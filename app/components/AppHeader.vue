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

        <nav
          v-if="isAdminRoute"
          class="hidden md:flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400"
        >
          <RouteSearch />
          <NuxtLink
            to="https://apay.run/docs"
            target="_blank"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >{{ $t('admin.nav.docs') }}</NuxtLink>
        </nav>
        <nav
          v-else
          class="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400"
        >
          <NuxtLink
            to="/"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >Home</NuxtLink>
          <NuxtLink
            to="/products"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >Products</NuxtLink>
          <NuxtLink
            to="/pricing"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >Pricing</NuxtLink>
          <NuxtLink
            to="/about"
            class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
          >About Us</NuxtLink>
        </nav>
      </div>

      <div class="flex items-center gap-4">
        <template v-if="!isAdminRoute">
          <div class="hidden md:block">
            <NuxtLink
              to="/admin/login"
              class="text-sm text-gray-600 transition-colors hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400"
            >
              <UButton
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white rounded-full px-6 font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              >
                <template #leading>
                  <Icon name="ph:user-fill" />
                </template>
                Login
              </UButton>
            </NuxtLink>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:list-bold"
            class="md:hidden"
            @click="$emit('open-mobile-menu')"
          />
        </template>

        <template v-else>
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
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const { getSetting } = useSettings()
const { locale, locales, t } = useI18n()
const colorMode = useColorMode()

defineEmits(['open-mobile-menu'])

const isDark = computed(() => colorMode.value === 'dark')
const route = useRoute()

const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

const isAdminRoute = computed(() => {
  const path = normalizeAdminPath(route.path)
  return path.startsWith('/admin') && path !== '/admin/login'
})

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
  }

  if (isAdminRoute.value) {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.reload()
      }, 50)
    }
    return
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
