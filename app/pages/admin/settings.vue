<template>
  <div class="max-w-5xl mx-auto pb-12">
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <UIcon
            name="ph:gear-six-fill"
            class="w-8 h-8 text-purple-500"
          />
          System Settings
        </h1>
        <p class="text-gray-400 mt-2 text-sm">Configure global site information, AI models, and theme preferences.</p>
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
          Save Changes
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Mobile Navigation for Settings -->
      <div class="block lg:hidden overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
        <nav class="flex space-x-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            @click="activeTab = tab.id"
            :class="[
              'flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
            ]"
          >
            <UIcon
              :name="tab.icon"
              class="w-5 h-5"
            />
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Left Sidebar Navigation for Settings -->
      <div class="lg:col-span-3 hidden lg:block space-y-1">
        <nav class="sticky top-24 space-y-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            @click="activeTab = tab.id"
            :class="[
              'w-full text-left block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
            ]"
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="tab.icon"
                class="w-5 h-5"
              />
              {{ tab.label }}
            </div>
          </button>
        </nav>
      </div>

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
            class="bg-gray-900/40 border border-gray-800 rounded-2xl p-6"
          >
            <div class="flex items-start justify-between gap-6">
              <div>
                <h2 class="text-lg font-bold text-white">站点图标</h2>
                <p class="text-sm text-gray-400 mt-1">
                  用于浏览器标签页与收藏夹展示。建议使用 .ico 或 32×32 PNG。
                </p>
              </div>
              <div
                v-if="dynamicForm.site_favicon"
                class="shrink-0 h-10 w-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden"
              >
                <img
                  :src="dynamicForm.site_favicon"
                  alt="favicon"
                  class="h-6 w-6"
                />
              </div>
            </div>

            <div class="mt-5">
              <div class="text-sm font-medium text-gray-300 mb-2">Favicon URL</div>
              <UInput
                v-model="dynamicForm.site_favicon"
                placeholder="例如：https://gopanel.cn/favicon.ico"
                size="lg"
              />
              <div class="mt-3 flex flex-col sm:flex-row gap-3">
                <UButton
                  type="button"
                  size="lg"
                  class="rounded-xl bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 justify-center"
                  :loading="isUploadingFavicon"
                  @click="triggerFaviconPick"
                >
                  上传图标
                </UButton>
                <UButton
                  v-if="dynamicForm.site_favicon"
                  type="button"
                  size="lg"
                  variant="outline"
                  class="rounded-xl border-gray-700 text-gray-200 hover:bg-gray-800 justify-center"
                  @click="dynamicForm.site_favicon = ''"
                >
                  清空
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
                留空则使用默认图标。保存后可刷新前台页面验证效果。
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
          <AdminSettingsWebhookTab
            v-if="activeTab === 'webhook'"
            :form="dynamicForm"
          />
          <AdminSettingsCompanyTab
            v-if="activeTab === 'company'"
            :form="dynamicForm"
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
              <span class="font-medium text-lg">Save</span>
            </UButton>
          </div>

          <!-- Desktop Save Button (Fallback) -->
          <div class="hidden lg:flex justify-end pt-4 border-t border-gray-800">
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
              Save All Settings
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
  useFetch,
  useCookie,
  useRouter,
} from '#imports'
const { fetchSettings, getSetting } = useSettings()

definePageMeta({ title: 'System Settings' })

const toast = useToast()
const router = useRouter()

const activeTab = ref('general')

const tabs = [
  { id: 'general', label: 'General Info', icon: 'ph:browser-fill' },
  { id: 'localization', label: 'Localization', icon: 'ph:translate-fill' },
  { id: 'seo', label: 'SEO', icon: 'ph:magnifying-glass-fill' },
  { id: 'checkout', label: 'Checkout', icon: 'ph:shopping-cart-fill' },
  { id: 'webhook', label: 'Webhook', icon: 'ph:plugs-fill' },
  { id: 'company', label: 'Company Details', icon: 'ph:buildings-fill' },
]

const {
  data: settings,
  error: settingsError,
  refresh,
} = useFetch('/api/admin/settings')

const form = reactive({
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
  allow_guest_checkout: true,
  company_name: '',
  company_phone: '',
  company_address: '',
  webhook_url: '',
  webhook_secret: '',
})

// Dynamically handle form properties initialized from API
const dynamicForm = reactive<Record<string, any>>({ ...form })

const isSaving = ref(false)
const isRebuilding = ref(false)
const isUploadingFavicon = ref(false)
const faviconInput = ref<HTMLInputElement | null>(null)

// Create a reactive flag to track if form is initialized
const isInitialized = ref(false)

// Populate form with existing settings once when data loads
watchEffect(() => {
  const err: any = settingsError.value
  if (err?.statusCode === 401 || err?.data?.statusCode === 401) {
    router.push('/admin/login')
    return
  }
  if (settings.value && Array.isArray(settings.value) && !isInitialized.value) {
    settings.value.forEach((s: any) => {
      // Allow dynamic keys (like zh_site_title) to be populated as well
      if (s.key === 'allow_guest_checkout') {
        dynamicForm.allow_guest_checkout =
          s.value === 'true' || s.value === true
      } else {
        // Initialize form with API data
        dynamicForm[s.key] = s.value
      }
    })
    isInitialized.value = true
  }
})

const triggerRebuild = async () => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Rebuild System',
    description:
      'Are you sure you want to rebuild and restart the system? This will cause a brief downtime of about 30-60 seconds.',
  })

  if (!isConfirmed) return

  isRebuilding.value = true
  try {
    const res: any = await $fetch('/api/admin/system/rebuild', {
      method: 'POST',
    })

    toast.add({
      title: 'Rebuild Initiated',
      description:
        res.message ||
        'System is rebuilding in the background. Please refresh the page in a minute.',
      color: 'success',
      duration: 10000,
    })
  } catch (e: any) {
    toast.add({
      title: 'Rebuild Failed',
      description:
        e.data?.message || e.message || 'Failed to initiate rebuild script',
      color: 'error',
    })
  } finally {
    isRebuilding.value = false
  }
}

const saveSettings = async () => {
  isSaving.value = true
  try {
    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: dynamicForm,
    })
    toast.add({
      title: 'Success',
      description: 'Settings saved successfully',
      color: 'success',
    })
    await refresh()

    // Update global store so changes reflect immediately on frontend
    await fetchSettings()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to save settings',
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
    dynamicForm.site_favicon = res.url
    toast.add({
      title: 'Success',
      description: 'Favicon uploaded successfully',
      color: 'success',
    })
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description:
        err?.data?.message || err?.message || 'Failed to upload favicon',
      color: 'error',
    })
  } finally {
    isUploadingFavicon.value = false
  }
}
</script>
