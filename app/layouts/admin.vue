<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans dark:bg-[#09090b] dark:text-gray-100">
    <AdminHeader @open-mobile-menu="isMobileMenuOpen = true" />

    <AdminMobileMenu v-model:open="isMobileMenuOpen" />

    <div class="flex flex-1 max-w-[1440px] w-full px-6 lg:px-12 mx-auto">
      <AdminSidebar />

      <main class="flex-1 min-w-0 py-10 pl-4 pr-4 md:pl-12 lg:pr-8">
        <div class="max-w-[1000px] mx-auto w-full">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// 后台专属布局:admin 页面通过 definePageMeta({ layout: 'admin' }) 直连,
// 不经过 default.vue 的主题分发器——后台永远不换主题皮肤,也不再与前台
// 商城共用 Header/MobileMenu(2026-07 拆分,此前靠 isAdminRoute 分支混用)。
// login/setup 两页保持 layout: false 全屏接管,不走本布局。
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)
</script>
