<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans dark:bg-[#09090b] dark:text-gray-100">
    <AdminHeader @open-mobile-menu="isMobileMenuOpen = true" />

    <AdminMobileMenu v-model:open="isMobileMenuOpen" />

    <AdminSidebar v-model:collapsed="sidebarCollapsed" />

    <!-- 侧栏 fixed 贴边,内容区用 padding-left 让位;宽度与 AdminSidebar 的 w-60/w-16 成对维护 -->
    <main
      class="transition-[padding-left] duration-200"
      :class="sidebarCollapsed ? 'md:pl-16' : 'md:pl-60'"
    >
      <div class="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8 lg:pt-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// 后台专属布局:admin 页面通过 definePageMeta({ layout: 'admin' }) 直连。
// 2026-07 参照 qingpu 用户中心改为贴边侧栏:侧栏 fixed 全高、可折叠成
// 图标栏,内容区单层 max-w-7xl(此前 1440 外筐 + 1000 内容双重限宽,
// 表格页在大屏上反而最挤)。底色 gray-50 衬页面内白卡片出层次。
// login/setup 两页保持 layout: false 全屏接管,不走本布局。
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)

// 折叠态存 cookie 而非 localStorage:SSR 首屏就能拿到,避免水合后跳变
const sidebarCollapsed = useCookie<boolean>('admin_sidebar_collapsed', {
  default: () => false,
  maxAge: 31536000,
})

// 每个页面组件按钮级权限判断都会各自调用 useAdminPermissions() 的 hasPerm(),
// 底层 admin 状态是 useState 共享的单例——这里在布局层统一触发一次加载
// (loadAdmin 内部幂等),避免每个页面都要重复 onMounted + loadAdmin 样板代码。
// 用 useAsyncData 而非裸 onMounted,让 SSR 首屏就能拿到正确的按钮可见性,
// 不会先渲染出"全部隐藏"再水合后才显示。
const { loadAdmin } = useAdminPermissions()
const { loadAdminLocale } = useAdminLocale()
// Explicit await (not fire-and-forget) so this is a real async setup()
// Vue/Nuxt must wait on via Suspense — without it, nothing guarantees the
// admin state is loaded before the page component's template (and its
// hasAdminPerm() button checks) renders on the server.
await useAsyncData('admin-permissions-bootstrap', () => loadAdmin())
await useAsyncData('admin-locale-bootstrap', () => loadAdminLocale())
</script>
