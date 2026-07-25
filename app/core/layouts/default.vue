<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans dark:bg-[#09090b] dark:text-gray-100">
    <AppHeader @open-mobile-menu="isMobileMenuOpen = true" />

    <AppMobileMenu v-model:open="isMobileMenuOpen" />

    <main>
      <slot />
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
// 纯前台兜底布局:仅在未激活任何主题时使用(7 个主题各有自带 layout)。
// admin 已走独立的 layouts/admin.vue(2026-07 拆分),本文件不再做
// isAdminRoute 分支/AdminSidebar 条件挂载。
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)
</script>
