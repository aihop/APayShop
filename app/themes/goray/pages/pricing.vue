<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white mb-4">
        选择适合您的保护方案
      </h1>
      <p class="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
        所有方案均包含四端客户端授权、国内智能分流、AI 编码生态加速与专属高速带宽。
      </p>
    </div>

    <!-- Pricing Grid -->
    <div class="grid md:grid-cols-3 gap-8 items-stretch">
      <!-- Monthly Plan -->
      <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">月度计划</div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">月付会员</h2>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-extrabold text-slate-900 dark:text-white">¥19.9</span>
            <span class="text-xs text-slate-400 font-medium">/ 月</span>
          </div>
          <ul class="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-8">
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              支持 3 台设备同时在线
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              不限流量 (高速无忧)
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              Claude Code / ChatGPT 全系加速
            </li>
          </ul>
        </div>
        <button
          @click="openCheckout(monthlyProduct || defaultMonthly)"
          class="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-sm transition-colors"
        >
          选择月付
        </button>
      </div>

      <!-- Yearly Plan (Featured) -->
      <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border-2 border-[#0066FF] flex flex-col justify-between shadow-xl shadow-blue-500/10 relative">
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#0066FF] text-white text-[11px] font-bold tracking-wider uppercase">
          最受欢迎 (省 40%)
        </div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-[#0066FF] mb-2">年度优选</div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">年付会员</h2>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-extrabold text-[#0066FF]">¥139.9</span>
            <span class="text-xs text-slate-400 font-medium">/ 年 (约 ¥11.6/月)</span>
          </div>
          <ul class="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-8">
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-[#0066FF]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              支持 5 台设备同时在线
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-[#0066FF]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              不限流量 + 优先线路调度
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-[#0066FF]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              专属 VIP 技术支持与极速响应
            </li>
          </ul>
        </div>
        <button
          @click="openCheckout(yearlyProduct || defaultYearly)"
          class="w-full py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          立即开通年付
        </button>
      </div>

      <!-- Quarterly Plan -->
      <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">季度计划</div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">季付会员</h2>
          <div class="flex items-baseline gap-1 mb-6">
            <span class="text-4xl font-extrabold text-slate-900 dark:text-white">¥49.9</span>
            <span class="text-xs text-slate-400 font-medium">/ 季 (约 ¥16.6/月)</span>
          </div>
          <ul class="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-8">
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              支持 3 台设备同时在线
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              不限流量 (高速无忧)
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              标准技术支持
            </li>
          </ul>
        </div>
        <button
          @click="openCheckout(quarterlyProduct || defaultQuarterly)"
          class="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-sm transition-colors"
        >
          选择季付
        </button>
      </div>
    </div>

    <!-- APay Payment Modal -->
    <PaymentModal
      v-if="selectedProduct"
      v-model="showPaymentModal"
      :product="selectedProduct"
      @success="handlePaymentSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const showPaymentModal = ref(false)
const selectedProduct = ref<any>(null)

const { data: productsData } = await useFetch('/api/products')

const gorayProducts = computed(() => {
  const list = productsData.value?.data || []
  return list.filter((p: any) => {
    try {
      const meta = typeof p.metaData === 'string' ? JSON.parse(p.metaData) : p.metaData
      return meta && meta.service === 'goray'
    } catch {
      return false
    }
  })
})

const monthlyProduct = computed(() => gorayProducts.value.find((p: any) => p.slug?.includes('month') || p.name?.includes('月')))
const quarterlyProduct = computed(() => gorayProducts.value.find((p: any) => p.slug?.includes('quarter') || p.name?.includes('季')))
const yearlyProduct = computed(() => gorayProducts.value.find((p: any) => p.slug?.includes('year') || p.name?.includes('年')))

const defaultMonthly = { id: 'goray_monthly', name: 'Goray 月付会员', price: 19.9, type: 'subscription' }
const defaultQuarterly = { id: 'goray_quarterly', name: 'Goray 季付会员', price: 49.9, type: 'subscription' }
const defaultYearly = { id: 'goray_yearly', name: 'Goray 年付会员', price: 139.9, type: 'subscription' }

const openCheckout = (prod: any) => {
  selectedProduct.value = prod
  showPaymentModal.value = true
}

const handlePaymentSuccess = () => {
  showPaymentModal.value = false
  navigateTo('/user/dashboard')
}
</script>
