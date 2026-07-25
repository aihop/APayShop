<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans dark:bg-[#09090b] dark:text-gray-100">
    <AppHeader @open-mobile-menu="isMobileMenuOpen = true" />

    <AppMobileMenu v-model:open="isMobileMenuOpen" />

    <div :class="isAdminRoute ? 'flex flex-1 max-w-[1440px] w-full px-6 lg:px-12 mx-auto' : ''">
      <AdminSidebar v-if="isAdminRoute" />

      <main :class="isAdminRoute ? 'flex-1 min-w-0 py-10 pl-4 pr-4 md:pl-12 lg:pr-8' : ''">
        <div :class="isAdminRoute ? 'max-w-[1000px] mx-auto w-full' : ''">
          <slot />
        </div>
      </main>
    </div>

    <AppFooter v-if="!isAdminRoute" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const route = useRoute()
const isMobileMenuOpen = ref(false)

const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

const isAdminRoute = computed(() => {
  const path = normalizeAdminPath(route.path)
  return path.startsWith('/admin') && path !== '/admin/login'
})
</script>
