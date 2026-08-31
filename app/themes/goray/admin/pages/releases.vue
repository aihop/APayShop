<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">客户端版本发布</h1>
        <p class="text-xs text-slate-500 mt-1">管理各平台客户端最新安装包、SHA-256 校验和与更新清单</p>
      </div>

      <button
        @click="showModal = true"
        class="px-4 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold shadow-sm transition-colors"
      >
        + 发布新版本
      </button>
    </div>

    <!-- Releases Table -->
    <div class="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
          <tr>
            <th class="px-4 py-3">平台</th>
            <th class="px-4 py-3">版本号 / Build</th>
            <th class="px-4 py-3">下载链接</th>
            <th class="px-4 py-3">SHA-256 Checksum</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">发布时间</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-if="releases.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400">暂无版本发布记录</td>
          </tr>
          <tr v-for="r in releases" :key="r.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <td class="px-4 py-3 font-bold uppercase">{{ r.platform }}</td>
            <td class="px-4 py-3 font-mono font-semibold">v{{ r.version }} ({{ r.build_number }})</td>
            <td class="px-4 py-3 text-slate-500 truncate max-w-[200px]">{{ r.download_url }}</td>
            <td class="px-4 py-3 font-mono text-[10px] text-slate-400 truncate max-w-[150px]">{{ r.sha256 }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="r.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'">
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ new Date(r.released_at).toLocaleDateString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">发布新版本</h2>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold mb-1">平台</label>
            <select v-model="form.platform" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <option value="macos">macOS</option>
              <option value="windows">Windows</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">版本号</label>
            <input v-model="form.version" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="1.0.0" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Build Number</label>
            <input v-model.number="form.build_number" type="number" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="1" />
          </div>
          <div>
            <label class="block font-semibold mb-1">文件大小 (Bytes)</label>
            <input v-model.number="form.file_size_bytes" type="number" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="15728640" />
          </div>
          <div class="col-span-2">
            <label class="block font-semibold mb-1">下载地址 (URL)</label>
            <input v-model="form.download_url" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" placeholder="https://..." />
          </div>
          <div class="col-span-2">
            <label class="block font-semibold mb-1">SHA-256 Checksum</label>
            <input v-model="form.sha256" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono" placeholder="64位十六进制哈希" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="showModal = false" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold">取消</button>
          <button @click="submitRelease" class="px-4 py-2 rounded-xl bg-[#0066FF] text-white text-xs font-bold">立即发布</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const releases = ref<any[]>([])
const showModal = ref(false)
const form = ref<any>({
  platform: 'macos',
  version: '1.0.0',
  build_number: 1,
  download_url: '',
  file_size_bytes: 1048576,
  sha256: '',
  status: 'published',
})

const loadReleases = async () => {
  try {
    const res: any = await $fetch('/api/admin/goray/releases')
    releases.value = res.data?.releases || []
  } catch {}
}

const submitRelease = async () => {
  try {
    await $fetch('/api/admin/goray/releases', {
      method: 'POST',
      body: form.value,
    })
    showModal.value = false
    await loadReleases()
  } catch (err: any) {
    alert(err.data?.message || '发布失败')
  }
}

onMounted(() => {
  loadReleases()
})
</script>
