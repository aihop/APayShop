<template>
  <div class="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#0066FF] selection:text-white transition-colors duration-200">
    <EmailVerificationBanner />
    <!-- Header -->
    <header class="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-[#0B0F19]/80 border-b border-slate-200/80 dark:border-slate-800/80">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="flex items-center gap-2.5 group">
            <div class="w-9 h-9 rounded-xl bg-[#0066FF] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Goray</span>
          </NuxtLink>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              active-class="text-[#0066FF] dark:text-[#3385FF] font-semibold bg-blue-50/50 dark:bg-blue-950/30"
            >
              {{ item.name }}
            </NuxtLink>
          </nav>
        </div>

        <!-- Right: Actions & User -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/activate"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-[#0066FF] dark:text-[#3385FF] bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            设备激活
          </NuxtLink>

          <NuxtLink
            v-if="user"
            to="/user/dashboard"
            class="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              {{ (user.name || user.email || 'U')[0].toUpperCase() }}
            </div>
            <span class="hidden sm:inline max-w-[120px] truncate text-xs">{{ user.name || user.email }}</span>
          </NuxtLink>

          <NuxtLink
            v-else
            to="/login"
            class="px-4 py-1.5 text-sm font-semibold rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            登录 / 注册
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] text-slate-500 dark:text-slate-400">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div class="col-span-2 md:col-span-1">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center text-white font-bold text-sm">
                G
              </div>
              <span class="text-lg font-bold text-slate-900 dark:text-white">Goray</span>
            </div>
            <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400 mb-4">
              极简、安全、专为现代开发者与非技术用户设计的网络保护工具。
            </p>
            <div class="text-xs text-slate-400">
              © {{ new Date().getFullYear() }} Goray.org. All rights reserved.
            </div>
          </div>

          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">产品</h4>
            <ul class="space-y-2 text-xs">
              <li><NuxtLink to="/pricing" class="hover:text-[#0066FF] transition-colors">方案定价</NuxtLink></li>
              <li><NuxtLink to="/downloads" class="hover:text-[#0066FF] transition-colors">客户端下载</NuxtLink></li>
              <li><NuxtLink to="/activate" class="hover:text-[#0066FF] transition-colors">设备激活</NuxtLink></li>
              <li><NuxtLink to="/docs" class="hover:text-[#0066FF] transition-colors">使用文档</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">支持</h4>
            <ul class="space-y-2 text-xs">
              <li><NuxtLink to="/contact-support" class="hover:text-[#0066FF] transition-colors">联系支持</NuxtLink></li>
              <li><NuxtLink to="/docs" class="hover:text-[#0066FF] transition-colors">排障指南</NuxtLink></li>
              <li><a href="mailto:support@goray.org" class="hover:text-[#0066FF] transition-colors">support@goray.org</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">合规与隐私</h4>
            <ul class="space-y-2 text-xs">
              <li><NuxtLink to="/privacy" class="hover:text-[#0066FF] transition-colors">隐私政策</NuxtLink></li>
              <li><NuxtLink to="/terms" class="hover:text-[#0066FF] transition-colors">服务条款</NuxtLink></li>
              <li><NuxtLink to="/refund-policy" class="hover:text-[#0066FF] transition-colors">退款政策</NuxtLink></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const navItems = [
  { name: '首页', path: '/' },
  { name: '定价', path: '/pricing' },
  { name: '下载', path: '/downloads' },
  { name: '设备激活', path: '/activate' },
  { name: '文档', path: '/docs' },
]

// @ts-ignore
const { user } = useUserSession()
</script>
