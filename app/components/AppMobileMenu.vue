<template>
  <USlideover
    v-model:open="innerOpen"
    side="left"
  >
    <template #content>
      <div class="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-[#09090b] dark:text-gray-100">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center gap-2">
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
