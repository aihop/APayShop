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
                :alt="getSetting('site_name')"
                icon-color="white"
              />
            </div>
            <span class="font-extrabold tracking-wide text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
              {{ getSetting('site_name') }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <ClientOnly>
              <UButton
                color="neutral"
                variant="ghost"
                :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
                :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                @click="toggleColorMode"
              />
            </ClientOnly>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x-bold"
              @click="closeMenu"
            />
          </div>
        </div>

        <nav class="flex flex-col gap-4">
          <div class="space-y-1">
            <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(storeSection) }}</h3>
            <template v-for="item in storeSection.items" :key="item.to">
              <NuxtLink
                v-if="!item.conditional || item.conditional()"
                :to="item.to"
                :class="adminMobileNavItemClass"
                @click="closeMenu"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    :name="item.icon"
                    class="w-5 h-5"
                  />
                  {{ resolveLabel(item) }}
                </div>
              </NuxtLink>
            </template>
          </div>

          <div
            v-if="extensionPages.length"
            class="space-y-1 mt-4"
          >
            <h3 :class="adminSectionTitleClass">{{ themeSectionTitle }}</h3>
            <NuxtLink
              v-for="page in extensionPages"
              :key="page.key"
              :to="page.route"
              :class="adminMobileNavItemClass"
              @click="closeMenu"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="page.icon"
                  class="w-5 h-5"
                />
                {{ page.title }}
              </div>
            </NuxtLink>
          </div>

          <div class="space-y-1 mt-4">
            <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(configSection) }}</h3>
            <NuxtLink
              v-for="item in configSection.items"
              :key="item.to"
              :to="item.to"
              :class="adminMobileNavItemClass"
              @click="closeMenu"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="item.icon"
                  class="w-5 h-5"
                />
                {{ resolveLabel(item) }}
              </div>
            </NuxtLink>
          </div>
        </nav>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
// 后台移动端导航抽屉,由 layouts/admin.vue 独占挂载。
// 2026-07 从 AppMobileMenu 的 isAdminRoute 分支拆出,只在 admin 布局内
// 渲染,因此不再需要路由判定,产品类型直接在挂载时加载。
import { onMounted } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { getSetting } = useSettings()
const { extensionPages, themeSectionTitle } = useAdminExtensions()
const { storeSection, configSection, resolveLabel, resolveSectionTitle, loadProductTypes } = useAdminNav()
const { adminSectionTitleClass, adminMobileNavItemClass } = useAdminNavStyle()
const colorMode = useColorMode()

const innerOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const isDark = computed(() => colorMode.value === 'dark')

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const closeMenu = () => {
  innerOpen.value = false
}

onMounted(async () => {
  await loadProductTypes()
})
</script>
