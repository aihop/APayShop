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
              :alt="getLocalizedSetting('site_name')"
              icon-color="white"
            />
          </div>
          <span class="font-extrabold tracking-wide text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            {{ getLocalizedSetting('site_name') }}
          </span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
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
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// 前台兜底商城头部(未激活主题时由 core 布局使用;7 个主题各有自带头部)。
// 2026-07 拆分:后台头部逻辑(语言切换/登出/用户菜单)移入 AdminHeader,
// 本组件不再做 isAdminRoute 分支判断。
const { getSetting } = useSettings()
const { getLocalizedSetting } = useLocalizedSettings()

defineEmits(['open-mobile-menu'])
</script>
