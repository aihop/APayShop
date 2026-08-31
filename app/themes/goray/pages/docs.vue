<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-16">
    <div class="mb-12">
      <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">使用与配置文档</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">快速了解如何在终端与各操作系统中使用 Goray。</p>
    </div>

    <div class="space-y-12 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      <!-- Section 1 -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4">🚀 终端 CLI 与 Claude Code 加速配置</h2>
        <p class="mb-4">
          Goray 客户端在本地默认监听 <strong>127.0.0.1:5486</strong> 混合代理端口。若需在 Terminal / VSCode 终端中加速 Node.js / Python 命令行工具（如 Claude Code），可在终端运行：
        </p>
        <div class="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto space-y-1">
          <div>export HTTP_PROXY=http://127.0.0.1:5486</div>
          <div>export HTTPS_PROXY=http://127.0.0.1:5486</div>
          <div>export ALL_PROXY=socks5://127.0.0.1:5486</div>
          <div>claude</div>
        </div>
      </div>

      <!-- Section 2 -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4">🛡️ 智能分流与全局保护模式</h2>
        <p class="mb-3">Goray 客户端提供两种工作模式：</p>
        <ul class="list-disc list-inside space-y-2 text-xs">
          <li><strong>智能保护模式（推荐）</strong>：内置国内常见网站与大陆 IP 直连规则，海外及 AI 流量自动走高速线路，既省流量又保流畅。</li>
          <li><strong>全局保护模式</strong>：所有出站网络流量全部经过加密线路，适用于公共 Wi-Fi 或高安全要求环境。</li>
        </ul>
      </div>

      <!-- Section 3 -->
      <div class="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4">📱 设备数量超限如何处理？</h2>
        <p class="mb-2">
          若在授权新设备时提示“设备数量超出上限”，您可以登录本网站进入 <strong>用户中心 → 设备管理</strong>，找到闲置设备点击“解绑”即可腾出名额。
        </p>
      </div>
    </div>
  </div>
</template>
