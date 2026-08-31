<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white mb-4">
        下载 Goray 客户端
      </h1>
      <p class="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
        支持主流桌面与移动操作系统。纯净无捆绑，一键安装。
      </p>
    </div>

    <!-- Download Cards Grid -->
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- macOS -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm">
        <div>
          <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center mb-4">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.65-.8 1.09-1.92.97-3.04-.94.04-2.09.63-2.76 1.42-.59.68-1.11 1.81-.97 2.91 1.05.08 2.12-.55 2.76-1.29z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">macOS</h3>
          <p class="text-xs text-slate-400 mb-4">macOS 12.0 及更高版本</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-6">
            <div>• 支持 Apple Silicon (M1/M2/M3/M4)</div>
            <div>• 支持 Intel x86_64</div>
            <div>• 系统 Network Extension 原生接入</div>
          </div>
        </div>
        <a
          href="/downloads/Goray-macOS-latest.dmg"
          class="w-full py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold text-center transition-colors block"
        >
          下载 .dmg 安装包
        </a>
      </div>

      <!-- Windows -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm">
        <div>
          <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center mb-4">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Windows</h3>
          <p class="text-xs text-slate-400 mb-4">Windows 10 / 11 64 位</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-6">
            <div>• 高性能 Wintun 驱动</div>
            <div>• 系统托盘开机自启</div>
            <div>• 智能路由与分流</div>
          </div>
        </div>
        <a
          href="/downloads/Goray-Windows-Setup-latest.exe"
          class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center transition-colors block"
        >
          下载 .exe 安装程序
        </a>
      </div>

      <!-- iOS -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm">
        <div>
          <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center mb-4">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">iOS / iPadOS</h3>
          <p class="text-xs text-slate-400 mb-4">iOS 15.0 及更高版本</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-6">
            <div>• 适配 iPhone & iPad</div>
            <div>• 熄屏省电与保活</div>
            <div>• 一键开关与小组件</div>
          </div>
        </div>
        <a
          href="https://apps.apple.com"
          target="_blank"
          class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center transition-colors block"
        >
          App Store 下载
        </a>
      </div>

      <!-- Android -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm">
        <div>
          <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center mb-4">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8533 8.1 12 8.1s-3.5902.311-5.1367.8507L4.841 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Android</h3>
          <p class="text-xs text-slate-400 mb-4">Android 8.0 及更高版本</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-6">
            <div>• 支持 ARM64 / x86_64</div>
            <div>• 应用级白名单分流</div>
            <div>• 常驻通知栏快捷控制</div>
          </div>
        </div>
        <a
          href="/downloads/Goray-Android-latest.apk"
          class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center transition-colors block"
        >
          下载 .apk 安装包
        </a>
      </div>
    </div>
  </div>
</template>
