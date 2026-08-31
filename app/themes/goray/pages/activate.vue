<template>
  <div class="max-w-xl mx-auto px-4 py-20">
    <div class="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-blue-500/5">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] flex items-center justify-center mb-4">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">授权新设备</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          请输入 Goray 客户端主屏幕上显示的 8 位验证码
        </p>
      </div>

      <!-- User Not Logged In Warning -->
      <div v-if="!user" class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs text-center mb-6">
        请先登录您的 APay 账号以完成设备授权。
        <div class="mt-3">
          <NuxtLink to="/login" class="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold inline-block">
            前往登录
          </NuxtLink>
        </div>
      </div>

      <!-- Code Input Step -->
      <div v-else-if="!deviceInfo && !authSuccess" class="space-y-6">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            8 位设备码
          </label>
          <input
            v-model="userCode"
            type="text"
            placeholder="例如: ABCD-EFGH"
            maxlength="9"
            @input="handleCodeInput"
            class="w-full px-4 py-3.5 text-center tracking-widest font-mono text-xl font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF] uppercase"
          />
        </div>

        <button
          @click="lookupCode"
          :disabled="loading || userCode.trim().length < 8"
          class="w-full py-3.5 rounded-2xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
        >
          <span v-if="loading">正在查询设备...</span>
          <span v-else>下一步</span>
        </button>

        <div v-if="errorMessage" class="text-xs text-red-500 text-center font-medium">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Device Confirm Step -->
      <div v-else-if="deviceInfo && !authSuccess" class="space-y-6">
        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">设备名称</span>
            <span class="font-bold text-slate-800 dark:text-slate-100">{{ deviceInfo.device_name }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">操作系统平台</span>
            <span class="font-bold uppercase text-slate-800 dark:text-slate-100">{{ deviceInfo.platform }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">客户端版本</span>
            <span class="font-mono text-slate-800 dark:text-slate-100">{{ deviceInfo.app_version }}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <button
            @click="confirmAuth(false)"
            :disabled="loading"
            class="py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            拒绝
          </button>
          <button
            @click="confirmAuth(true)"
            :disabled="loading"
            class="py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-colors"
          >
            确认授权并连接
          </button>
        </div>

        <div v-if="errorMessage" class="text-xs text-red-500 text-center font-medium">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="authSuccess" class="text-center py-6 space-y-4">
        <div class="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">授权已成功！</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          客户端现在已获得加密连接凭证，将在几秒内自动完成握手并就绪。
        </p>
        <div class="pt-4">
          <NuxtLink to="/user/dashboard" class="px-6 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors">
            前往设备管理
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// @ts-ignore
const { user } = useUserSession()

const userCode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const deviceInfo = ref<any>(null)
const authSuccess = ref(false)

const handleCodeInput = (e: any) => {
  let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (val.length > 4) {
    val = `${val.slice(0, 4)}-${val.slice(4, 8)}`
  }
  userCode.value = val
  if (val.length === 9) {
    lookupCode()
  }
}

const lookupCode = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    const res: any = await $fetch(`/api/goray/v1/web/device-authorization/lookup?code=${userCode.value}`)
    deviceInfo.value = res.data
  } catch (err: any) {
    errorMessage.value = err.data?.message || '设备码无效或已过期'
  } finally {
    loading.value = false
  }
}

const confirmAuth = async (approved: boolean) => {
  errorMessage.value = ''
  loading.value = true
  try {
    await $fetch('/api/goray/v1/web/device-authorization/confirm', {
      method: 'POST',
      body: {
        auth_id: deviceInfo.value.id,
        approved,
      },
    })
    if (approved) {
      authSuccess.value = true
    } else {
      deviceInfo.value = null
      userCode.value = ''
      errorMessage.value = '已拒绝该设备的授权请求'
    }
  } catch (err: any) {
    errorMessage.value = err.data?.message || '授权失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>
