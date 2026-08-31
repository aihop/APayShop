<template>
  <div class="space-y-24 pb-20">
    <!-- Hero Section -->
    <section class="relative pt-16 sm:pt-24 pb-12 overflow-hidden">
      <!-- Background Glow -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div class="max-w-5xl mx-auto px-4 text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-[#3385FF] border border-blue-100 dark:border-blue-900/50 mb-8 animate-fade-in">
          <span class="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse"></span>
          面向现代开发者的极简网络保护
        </div>

        <!-- Title -->
        <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.15] mb-6">
          一键开启<br class="hidden sm:inline" />
          <span class="bg-gradient-to-r from-[#0066FF] via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            高速、纯净与安全网络
          </span>
        </h1>

        <!-- Subtitle -->
        <p class="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-10">
          告别繁琐的节点配置与复杂的参数术语。Goray 以优雅的大留白界面、智能国内直连分流与专属 AI 规则，让连接回归最纯粹的简单。
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-wrap items-center justify-center gap-4">
          <NuxtLink
            to="/pricing"
            class="px-8 py-3.5 rounded-2xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold text-base shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            立即获取订阅
          </NuxtLink>
          <NuxtLink
            to="/downloads"
            class="px-8 py-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-base hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm transition-all"
          >
            下载客户端
          </NuxtLink>
        </div>

        <!-- Hero App Visual Mockup -->
        <div class="mt-16 max-w-sm mx-auto p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-blue-500/10">
          <div class="flex items-center justify-between text-xs text-slate-400 mb-8">
            <span class="font-medium">Goray for macOS</span>
            <span class="inline-flex items-center gap-1 text-emerald-500 font-semibold">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>已保护
            </span>
          </div>

          <!-- Giant Toggle Mock -->
          <div class="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-[#0066FF] text-white flex flex-col items-center justify-center shadow-xl shadow-blue-500/30 cursor-pointer hover:scale-105 transition-transform duration-300">
            <svg class="w-10 h-10 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2v10m0 0a8 8 0 100 16 8 8 0 000-16z"/>
            </svg>
            <span class="text-xs font-bold uppercase tracking-wider">Connected</span>
          </div>

          <!-- Metrics Mock -->
          <div class="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <div>
              <div class="text-[11px] text-slate-400">当前线路</div>
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">香港 01</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400">网络延迟</div>
              <div class="text-xs font-bold text-emerald-500 mt-0.5">38 ms</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400">下载速率</div>
              <div class="text-xs font-bold text-blue-500 mt-0.5">18.4 MB/s</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3-Step Quick Start -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="text-center mb-16">
        <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          三步开始使用，无需复杂设置
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
          专为非技术用户与现代团队打造的无感体验
        </p>
      </div>

      <div class="grid md:grid-cols-3 gap-8">
        <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 relative">
          <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] font-bold flex items-center justify-center text-lg mb-6">
            1
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">开通订阅方案</h3>
          <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            按需选择月付或年付方案，在线完成支付，即可获取高带宽、低延迟的专属网络保护通道。
          </p>
        </div>

        <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 relative">
          <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] font-bold flex items-center justify-center text-lg mb-6">
            2
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">下载安装客户端</h3>
          <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            支持 macOS、iOS、Android 与 Windows 全平台，轻量安装包，不占用多余系统资源。
          </p>
        </div>

        <div class="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 relative">
          <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] font-bold flex items-center justify-center text-lg mb-6">
            3
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">输入设备码即连</h3>
          <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            App 打开即显 8 位验证码，在网页一键确认即可安全绑定，无需在客户端输入密码。
          </p>
        </div>
      </div>
    </section>

    <!-- Core Features -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="grid md:grid-cols-2 gap-8">
        <div class="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
          <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center mb-6">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
            深度加速 AI 编码生态
          </h3>
          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            内置针对 Claude Code、Cursor、Antigravity、ChatGPT 及 Statsig 遥测服务的完整分流策略，消除由于网络阻断引起的连接重置。
          </p>
        </div>

        <div class="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
            智能国内分流与直连
          </h3>
          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            内置 5900+ 条智能规则与中国大陆 IP 地址库，国内网站和常见应用丝滑直连，不消耗代理流量，兼具极致网速与稳定性。
          </p>
        </div>

        <div class="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
          <div class="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
            端到端加密与安全信封
          </h3>
          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            采用 P-256 ECDH 与 AES-256-GCM 动态加密下发节点，节点密钥仅存在于运行内存，严格遵循零日志协议，捍卫数字隐私。
          </p>
        </div>

        <div class="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">
            四端覆盖与多设备共享
          </h3>
          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            支持同时在 Mac、iPhone、iPad、Android 与 Windows 电脑上使用，控制面板清晰展示在线设备，支持一键远程解绑。
          </p>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="max-w-5xl mx-auto px-4 text-center">
      <div class="p-12 sm:p-16 rounded-3xl bg-gradient-to-br from-blue-600 via-[#0066FF] to-indigo-700 text-white shadow-2xl shadow-blue-500/20">
        <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          准备好体验纯净网络了吗？
        </h2>
        <p class="text-sm sm:text-base text-blue-100 max-w-xl mx-auto mb-8">
          一键开启，无缝加速。现在订阅即可享受高速稳定的全球网络服务。
        </p>
        <NuxtLink
          to="/pricing"
          class="px-8 py-3.5 rounded-2xl bg-white text-[#0066FF] font-bold text-base hover:bg-blue-50 shadow-lg transition-transform hover:scale-105 active:scale-95 inline-block"
        >
          查看所有套餐方案
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
