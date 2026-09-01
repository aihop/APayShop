<template>
  <USlideover
    v-model:open="innerOpen"
    side="left"
  >
    <template #content>
      <div class="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-[#09090b] dark:text-gray-100">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center gap-2.5">
            <div
              v-if="getSetting('site_logo')"
              class="w-8 h-8 flex items-center justify-center"
            >
              <SiteLogo
                :logo-data="getSetting('site_logo')"
                :alt="getLocalizedSetting('site_name')"
              />
            </div>
            <span class="relative inline-flex items-center font-bold tracking-tight text-lg sm:text-xl">
              <span class="absolute -inset-x-1.5 -inset-y-0.5 rounded-lg bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-cyan-500/15 blur-sm dark:opacity-40 dark:animate-pulse pointer-events-none"></span>
              <span class="relative bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-200 dark:to-indigo-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                {{ getLocalizedSetting('site_name') }}
              </span>
            </span>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:x-bold"
            @click="closeMenu"
          />
        </div>

        <nav class="flex flex-col flex-1">
          <NuxtLink
            to="/"
            class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
            @click="closeMenu"
          >Home</NuxtLink>
          <NuxtLink
            to="/products"
            class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
            @click="closeMenu"
          >Products</NuxtLink>
          <NuxtLink
            to="/pricing"
            class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
            @click="closeMenu"
          >Pricing</NuxtLink>
          <NuxtLink
            to="/about"
            class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
            @click="closeMenu"
          >About</NuxtLink>
          <NuxtLink
            to="/contact"
            class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
            @click="closeMenu"
          >Contact</NuxtLink>

          <div class="mt-auto pt-8">
            <NuxtLink
              to="/admin/login"
              @click="closeMenu"
            >
              <UButton
                color="primary"
                class="w-full justify-center bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              >
                <template #leading>
                  <Icon name="ph:user-fill" />
                </template>
                Login
              </UButton>
            </NuxtLink>
          </div>
        </nav>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
// 前台兜底商城移动菜单(未激活主题时由 core 布局使用)。
// 2026-07 拆分:后台导航抽屉移入 AdminMobileMenu,本组件不再依赖
// useAdminNav/useAdminExtensions,也不做 isAdminRoute 分支判断。
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { getSetting } = useSettings()
const { getLocalizedSetting } = useLocalizedSettings()

const innerOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const closeMenu = () => {
  innerOpen.value = false
}
</script>
