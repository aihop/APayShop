<template>
  <div class="max-w-5xl mx-auto pb-12">
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <UIcon
            name="ph:gear-six-fill"
            class="w-8 h-8 text-purple-500"
          />
          {{ $t('admin.settings.page.title') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.settings.page.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] rounded-full px-6"
          type="button"
          @click="saveSettings"
          :loading="isSaving"
        >
          <template #leading>
            <UIcon
              name="ph:floppy-disk-fill"
              class="w-5 h-5"
            />
          </template>
          {{ $t('admin.settings.page.save_changes') }}
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- 设置族共享导航(移动横滚 + 桌面左栏两块由组件多根输出);清单单点 nav-tabs.ts -->
      <AdminSettingsNav
        :active="activeTab"
        @select="activeTab = $event"
      />

      <!-- Main Form Area -->
      <div class="lg:col-span-9 space-y-8">
        <form
          @submit.prevent="saveSettings"
          class="space-y-8"
        >
          <AdminSettingsGeneralTab
            v-if="activeTab === 'general'"
            :form="dynamicForm"
          />
          <div
            v-if="activeTab === 'general'"
            class="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-6"
          >
            <div class="flex items-start justify-between gap-6">
              <div>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.settings.general.favicon_title') }}</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ $t('admin.settings.general.favicon_desc') }}
                </p>
              </div>
              <div
                v-if="dynamicForm.site_favicon"
                class="shrink-0 h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden"
              >
                <img
                  :src="dynamicForm.site_favicon"
                  alt="favicon"
                  class="h-6 w-6"
                />
              </div>
            </div>

            <div class="mt-5">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('admin.settings.general.favicon_url') }}</div>
              <UInput
                v-model="dynamicForm.site_favicon"
                placeholder="https://gopanel.cn/favicon.ico"
                size="lg"
              />
              <div class="mt-3 flex flex-col sm:flex-row gap-3">
                <UButton
                  type="button"
                  size="lg"
                  class="rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 justify-center"
                  :loading="isUploadingFavicon"
                  @click="triggerFaviconPick"
                >
                  {{ $t('admin.settings.general.upload_favicon') }}
                </UButton>
                <UButton
                  v-if="dynamicForm.site_favicon"
                  type="button"
                  size="lg"
                  variant="outline"
                  class="rounded-xl border-gray-200 dark:border-gray-700 text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 justify-center"
                  @click="dynamicForm.site_favicon = ''"
                >
                  {{ $t('admin.settings.general.clear_favicon') }}
                </UButton>
                <input
                  ref="faviconInput"
                  type="file"
                  accept="image/x-icon,image/png,image/svg+xml,image/*"
                  class="hidden"
                  @change="handleFaviconSelected"
                >
              </div>
              <div class="text-xs text-gray-500 mt-2">
                {{ $t('admin.settings.general.favicon_hint') }}
              </div>
            </div>
          </div>
          <AdminSettingsLocalizationTab
            v-if="activeTab === 'localization'"
            :form="dynamicForm"
          />
          <AdminSettingsSEOTab
            v-if="activeTab === 'seo'"
            :form="dynamicForm"
          />
          <AdminSettingsCheckoutTab
            v-if="activeTab === 'checkout'"
            :form="dynamicForm"
          />
          <AdminSettingsTopupTab
            v-if="activeTab === 'topup'"
            :form="dynamicForm"
          />
          <AdminSettingsIntegrationTab
            v-if="activeTab === 'integration'"
            :form="dynamicForm"
          />
          <AdminSettingsEmailTab
            v-if="activeTab === 'email'"
            :form="dynamicForm"
          />
          <AdminSettingsCompanyTab
            v-if="activeTab === 'company'"
            :form="dynamicForm"
          />

          <!-- 自动化(事件规则 + 定时任务):自管理数据,独立于上方设置表单的保存按钮 -->
          <AdminSettingsAutomationsTab
            v-if="activeTab === 'automations'"
          />
          <AdminSettingsSchedulerTab
            v-if="activeTab === 'scheduler'"
          />

          <!-- Sticky Mobile Save Button -->
          <div class="fixed bottom-6 right-6 lg:hidden z-40">
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] rounded-full h-14 px-6"
              type="submit"
              :loading="isSaving"
            >
              <template #leading>
                <UIcon
                  name="ph:floppy-disk-fill"
                  class="w-6 h-6"
                />
              </template>
              <span class="font-medium text-lg">{{ $t('admin.settings.page.save') }}</span>
            </UButton>
          </div>

          <!-- Desktop Save Button (Fallback) -->
          <div class="hidden lg:flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] px-8 py-2.5"
              type="submit"
              size="lg"
              :loading="isSaving"
            >
              <template #leading>
                <UIcon
                  name="ph:floppy-disk-fill"
                  class="w-5 h-5"
                />
              </template>
              {{ $t('admin.settings.page.save_all') }}
            </UButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  definePageMeta,
  useToast,
  useRoute,
  useI18n,
} from '#imports'
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'
const { settings: settingsStore, fetchSettings } = useSettings()
const { t } = useI18n()

definePageMeta({ title: 'System Settings', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()

const route = useRoute()
const activeTab = ref(isSettingsTabId(route.query.tab) ? route.query.tab : 'general')

const refresh = async () => { await fetchSettings(true) }

onMounted(() => { if (!settingsStore.value) void fetchSettings(false) })

const DEFAULT_FORM: Record<string, any> = {
  site_title: '',
  site_description: '',
  site_name: '',
  site_logo: '',
  site_favicon: '',
  site_notice: '',
  support_email: '',
  supported_locales: 'en,zh',
  default_locale: 'en',
  currency: 'USD',
  timezone: '',
  allow_guest_checkout: true,
  disable_multi_device_login: false,
  company_name: '',
  company_phone: '',
  company_address: '',
  webhook_url: '',
  integration_token: '',
}

const buildFormFromStore = (store: Record<string, string>): Record<string, any> => {
  const next: Record<string, any> = { ...DEFAULT_FORM }
  for (const [key, raw] of Object.entries(store)) {
    if (key === 'allow_guest_checkout' || key === 'disable_multi_device_login') {
      next[key] = (String(raw) === 'true' || raw === true) as any
    } else {
      next[key] = raw as any
    }
  }
  return next
}

// dynamicForm 必须用 ref 而不是 reactive:
// 如果用 reactive + 逐个 key 赋值,每个 setter 都会同步 trigger 已经订阅了 v-model 的 8 个 Tab
// 子组件重渲染 / computed 级联,20 个 key 写入就会放大成几百次更新,主线程直接卡死。
// ref 整对象替换只会 trigger 1 次全局通知,子组件合并同一帧 patch,首帧秒开。
const dynamicForm = ref<Record<string, any>>(
  settingsStore.value ? buildFormFromStore(settingsStore.value) : { ...DEFAULT_FORM },
)

const isSaving = ref(false)
const isUploadingFavicon = ref(false)
const faviconInput = ref<HTMLInputElement | null>(null)

const isInitialized = ref(!!settingsStore.value)

watch(
  () => settingsStore.value,
  (store) => {
    if (!store || isInitialized.value) return
    dynamicForm.value = buildFormFromStore(store)
    isInitialized.value = true
  },
  { once: true, flush: 'post' },
)

const saveSettings = async () => {
  isSaving.value = true
  try {
    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: dynamicForm.value,
    })
    toast.add({
      title: t('admin.settings.general.toast_success'),
      description: t('admin.settings.general.toast_settings_saved'),
      color: 'success',
    })
    await refresh()
    await fetchSettings()
  } catch (e: any) {
    toast.add({
      title: t('admin.settings.general.toast_error'),
      description: e.data?.message || t('admin.settings.general.toast_save_failed'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const triggerFaviconPick = () => {
  faviconInput.value?.click()
}

const handleFaviconSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  isUploadingFavicon.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res: any = await $fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })
    dynamicForm.value.site_favicon = res.url
    toast.add({
      title: t('admin.settings.general.toast_success'),
      description: t('admin.settings.general.toast_favicon_uploaded'),
      color: 'success',
    })
  } catch (err: any) {
    toast.add({
      title: t('admin.settings.general.toast_error'),
      description:
        err?.data?.message || err?.message || t('admin.settings.general.toast_favicon_failed'),
      color: 'error',
    })
  } finally {
    isUploadingFavicon.value = false
  }
}
</script>
