<template>
  <div>
    <div class="flex justify-between items-end mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.payments.page.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.payments.page.subtitle') }}</p>
      </div>
      <UButton
        v-if="activeTab === 'methods' && hasAdminPerm('payments:edit')"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.payments.page.add_method') }}</UButton>
    </div>

    <UTabs
      v-model="activeTab"
      :items="tabItems"
      class="mb-6"
    />

    <!-- Methods Tab -->
    <div v-if="activeTab === 'methods'">
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden">
        <UTable
          :columns="columns"
          :data="methods || []"
          :loading="pending"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-3">
              <img
                v-if="row.original.iconUrl"
                :src="String(row.original.iconUrl)"
                :alt="String(row.original.name)"
                class="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-800 bg-white object-contain p-1"
              >
              <div
                v-else
                class="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                <UIcon name="ph:credit-card-bold" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ row.original.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ row.original.code }}</div>
                <div class="mt-1">
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >{{ getMethodLocaleSummary(String(row.original.supportedLocales || '')) }}</UBadge>
                </div>
              </div>
            </div>
          </template>

          <template #isActive-cell="{ row }">
            <div class="flex items-center gap-2">
              <USwitch
                :model-value="Boolean(row.original.isActive)"
                :disabled="Boolean(row.original.isLocalOnly) || !hasAdminPerm('payments:edit')"
                @update:model-value="val => { if(!row.original.isLocalOnly) { row.original.isActive = val; toggleActive(row.original) } }"
              />
              <UBadge
                v-if="row.original.isLocalOnly"
                color="warning"
                variant="subtle"
                size="xs"
              >{{ $t('admin.payments.badge.unconfigured') }}</UBadge>
              <UBadge
                v-else-if="row.original.hasLocalFiles"
                color="success"
                variant="subtle"
                size="xs"
              >{{ $t('admin.payments.badge.local_plugin') }}</UBadge>
              <UBadge
                v-else
                color="info"
                variant="subtle"
                size="xs"
              >{{ $t('admin.payments.badge.db_only') }}</UBadge>
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                :icon="row.original.isLocalOnly ? 'ph:plug-bold' : 'ph:pencil-simple'"
                :label="row.original.isLocalOnly ? $t('admin.payments.table.configure') : ''"
                @click="openModal(row.original)"
                :disabled="!hasAdminPerm('payments:edit')"
              />
              <UButton
                v-if="!row.original.isLocalOnly"
                color="error"
                variant="ghost"
                icon="ph:trash"
                @click="deleteMethod(Number(row.original.id))"
                :disabled="!hasAdminPerm('payments:edit')"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Payment Method Modal -->
      <FullScreenModal
        v-model="isModalOpen"
        maxWidth="sm:max-w-6xl"
        :title="form.id ? $t('admin.payments.modal.edit_title') : $t('admin.payments.modal.new_title')"
      >
        <form
          @submit.prevent="saveMethod"
          class="space-y-4"
        >
          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('admin.payments.modal.name_label')">
              <UInput
                v-model="form.name"
                required
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('admin.payments.modal.code_label')">
              <UInput
                v-model="form.code"
                required
                class="w-full"
                :disabled="!!form.id"
              />
            </UFormField>
          </div>

          <UFormField :label="$t('admin.payments.modal.icon_label')">
            <UInput
              v-model="form.iconUrl"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('admin.payments.modal.language_label')">
            <div class="space-y-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('admin.payments.modal.language_help') }}
              </p>

              <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                <button
                  v-for="localeOption in paymentLocaleOptions"
                  :key="localeOption.code"
                  type="button"
                  :class="[
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                    isMethodLocaleSelected(localeOption.code)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-200'
                      : 'border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-[#09090b] text-gray-600 dark:text-gray-300'
                  ]"
                  @click="toggleMethodLocale(localeOption.code, !isMethodLocaleSelected(localeOption.code))"
                >
                  <UCheckbox
                    :model-value="isMethodLocaleSelected(localeOption.code)"
                      @update:model-value="(checked) => toggleMethodLocale(localeOption.code, Boolean(checked))"
                    @click.stop
                  />
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate">{{ localeOption.label }}</div>
                    <div class="text-[11px] text-gray-500 uppercase">{{ localeOption.code }}</div>
                  </div>
                </button>
              </div>

              <UBadge
                color="neutral"
                variant="subtle"
              >{{ getMethodLocaleSummary(form.supportedLocales) }}</UBadge>
            </div>
          </UFormField>

          <UFormField :label="$t('admin.payments.modal.info_label')">
            <UTextarea
              v-model="form.info"
              class="h-full w-full font-mono text-sm"
              :rows="8"
            />
            <template #help>
              <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.info_help') }}</span>
            </template>
          </UFormField>

          <UFormField :label="$t('admin.payments.modal.create_label')">
            <UTextarea
              v-model="form.create"
              :rows="12"
              class="font-mono text-sm w-full"
            />
            <template #help>
              <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.create_help') }}</span>
            </template>
          </UFormField>

          <UFormField :label="$t('admin.payments.modal.callback_label')">
            <UTextarea
              v-model="form.callback"
              :rows="12"
              class="font-mono text-sm w-full"
            />
            <template #help>
              <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.callback_help') }}</span>
            </template>
          </UFormField>

          <UFormField :label="$t('admin.payments.modal.config_label')">
            <UTextarea
              v-model="form.configJson"
              :rows="12"
              class="font-mono text-sm w-full"
              @input="onJsonChange"
            />
            <p
              v-if="hasJsonError"
              class="text-xs text-red-500 mt-1"
            >{{ $t('admin.payments.modal.config_invalid') }}</p>
          </UFormField>

          <UFormField>
            <UCheckbox
              v-model="form.isActive"
              :label="$t('admin.payments.modal.enable_label')"
            />
          </UFormField>

          <div class="flex justify-end gap-3 mt-8">
            <UButton
              color="neutral"
              variant="ghost"
              @click="closeMethodModal"
            >{{ $t('admin.payments.modal.cancel') }}</UButton>
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              type="submit"
              :loading="isSaving"
              :disabled="!hasAdminPerm('payments:edit')"
            >{{ $t('admin.payments.modal.save') }}</UButton>
          </div>
        </form>
      </FullScreenModal>
    </div>

    <!-- Failures Tab -->
    <div v-if="activeTab === 'failures'">
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden">
        <UTable
          :columns="failuresColumns"
          :data="failures || []"
          :loading="failuresPending"
        >
          <template #id-cell="{ row }">
            <span class="text-xs text-gray-400 font-mono">{{ String(row.original.id || '') }}</span>
          </template>
          <template #visitorId-cell="{ row }">
            <span
              v-if="row.original.visitorId"
              class="text-xs text-gray-500 font-mono cursor-pointer hover:text-primary-400 transition-colors"
              :title="String(row.original.visitorId)"
              @click="copyVisitorId(String(row.original.visitorId))"
            >
              {{ String(row.original.visitorId).substring(0, 8) }}...
            </span>
            <span
              v-else
              class="text-xs text-gray-600"
            >-</span>
          </template>
          <template #orderId-cell="{ row }">
            <span class="text-xs text-gray-400 font-mono">{{ String(row.original.orderId || '').substring(0, 8) }}...</span>
          </template>

          <template #cardBin-cell="{ row }">
            <span class="font-mono text-gray-300">{{ row.original.cardBin || $t('admin.payments.failures.n/a') }}</span>
          </template>

          <template #amount-cell="{ row }">
            ${{ Number(row.original.amount || 0).toFixed(2) }}
          </template>

          <template #reason-cell="{ row }">
            <span class="text-red-400 text-sm">{{ row.original.reason }}</span>
          </template>

          <template #payMethod-cell="{ row }">
            <UBadge
              color="neutral"
              variant="subtle"
              class="capitalize"
            >
              {{ row.original.payMethod || $t('admin.payments.failures.unknown') }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:eye"
              @click="viewDetails(row.original)"
            />
          </template>
        </UTable>
      </div>

      <!-- Details Modal -->
      <UModal
        v-model:open="isFailuresModalOpen"
        :ui="{ content: 'bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800 sm:max-w-2xl' }"
      >
        <template #content>
          <div class="p-6">
            <div class="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('admin.payments.failures.details') }}</h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:x"
                class="-my-1"
                @click="closeFailuresModal"
              />
            </div>

            <div
              v-if="selectedFailure"
              class="space-y-4"
            >
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.id') }}</span>
                  <span class="text-gray-900 dark:text-white">{{ selectedFailure.id }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.orderId') }}</span>
                  <span class="text-gray-900 dark:text-white font-mono text-sm">{{ selectedFailure.orderId }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.amount') }}</span>
                  <span class="text-gray-900 dark:text-white">${{ Number(selectedFailure.amount || 0).toFixed(2) }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.cardBin') }}</span>
                  <span class="text-gray-900 dark:text-white font-mono">{{ selectedFailure.cardBin || $t('admin.payments.failures.n/a') }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.customerEmail') }}</span>
                  <span class="text-gray-900 dark:text-white">{{ selectedFailure.contactEmail || $t('admin.payments.failures.n/a') }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.paymentMethod') }}</span>
                  <span class="text-gray-900 dark:text-white capitalize">{{ selectedFailure.payMethod || $t('admin.payments.failures.unknown') }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.payments.failures.time') }}</span>
                  <span class="text-gray-900 dark:text-white">{{ formatDateTime(selectedFailure.createdAt) }}</span>
                </div>
              </div>

              <div class="mt-6">
                <span class="block text-xs text-gray-500 mb-2">{{ $t('admin.payments.failures.failureReason') }}</span>
                <div class="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400">
                  {{ selectedFailure.reason }}
                </div>
              </div>

              <div
                v-if="selectedFailure.rawResponse"
                class="mt-4"
              >
                <span class="block text-xs text-gray-500 mb-2">{{ $t('admin.payments.failures.rawGatewayResponse') }}</span>
                <div class="p-3 bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                  <pre class="text-xs text-gray-500 dark:text-gray-400 m-0">{{ formatJson(selectedFailure.rawResponse) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  definePageMeta,
  useToast,
  useFetch,
  useI18n,
} from '#imports'

definePageMeta({ title: 'Payment Methods', layout: 'admin' })

const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()
const { confirm } = useConfirm()
const { settings: appSettings, fetchSettings } = useSettings()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const activeTab = ref('methods')

await fetchSettings()

const tabItems = computed(() => [
  { label: t('admin.payments.page.tabs.methods'), value: 'methods', icon: 'ph:credit-card' },
  { label: t('admin.payments.page.tabs.failures'), value: 'failures', icon: 'ph:warning-circle' },
])

// ---- Methods Tab ----

const columns = [
  { accessorKey: 'name', header: t('admin.payments.table.name') },
  { accessorKey: 'isActive', header: t('admin.payments.table.status') },
  { accessorKey: 'actions', header: t('admin.payments.table.actions') },
]

const {
  data: methods,
  pending,
  refresh,
} = await useFetch<any[]>('/api/admin/payments', {
  onResponseError({ response }) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const isSaving = ref(false)
const isModalOpen = ref(false)
const form = reactive({
  id: null as number | null,
  name: '',
  code: '',
  iconUrl: '',
  supportedLocales: '',
  configJson: '{}',
  info: '',
  create: '',
  callback: '',
  isActive: false,
})

const baseLocaleOptions = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁体中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
]

const normalizeLocaleCode = (value: string) => {
  const normalized = String(value || '').trim().replace(/_/g, '-')
  if (!normalized) return ''

  const [language, region, ...rest] = normalized.split('-').filter(Boolean)
  if (!language) return ''

  const parts = [language.toLowerCase()]
  if (region) parts.push(region.length <= 3 ? region.toUpperCase() : region.toLowerCase())
  if (rest.length) parts.push(...rest.map(part => part.toLowerCase()))
  return parts.join('-')
}

const parseLocaleCodes = (value: string | null | undefined) => {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map(item => normalizeLocaleCode(item))
      .filter(Boolean)
  ))
}

const selectedMethodLocales = computed(() => parseLocaleCodes(form.supportedLocales))

const paymentLocaleOptions = computed(() => {
  const configuredLocales = parseLocaleCodes(appSettings.value?.supported_locales || 'en,zh')
  const allCodes = Array.from(new Set([
    ...configuredLocales,
    ...selectedMethodLocales.value,
  ]))

  return allCodes.map((code) => {
    const matched = baseLocaleOptions.find(locale => normalizeLocaleCode(locale.code) === code)
    return matched || { code, label: code }
  })
})

const isMethodLocaleSelected = (code: string) => {
  const normalizedCode = normalizeLocaleCode(code)
  return selectedMethodLocales.value.includes(normalizedCode)
}

const toggleMethodLocale = (code: string, checked: boolean) => {
  const normalizedCode = normalizeLocaleCode(code)
  let current = [...selectedMethodLocales.value]

  if (checked && !current.includes(normalizedCode)) {
    current.push(normalizedCode)
  } else if (!checked) {
    current = current.filter(item => item !== normalizedCode)
  }

  const visualOrder = paymentLocaleOptions.value
    .map(option => normalizeLocaleCode(option.code))
    .filter(optionCode => current.includes(optionCode))

  form.supportedLocales = visualOrder.join(',')
}

const getMethodLocaleSummary = (value: string | null | undefined) => {
  const locales = parseLocaleCodes(value)
  if (!locales.length) {
    return t('admin.payments.modal.language_all')
  }

  return locales.join(', ')
}

const hasJsonError = ref(false)

const onJsonChange = () => {
  try {
    JSON.parse(form.configJson)
    hasJsonError.value = false
  } catch (e) {
    hasJsonError.value = true
  }
}

const openModal = (method?: any) => {
  hasJsonError.value = false
  if (method) {
    Object.assign(form, method)
    form.supportedLocales = typeof form.supportedLocales === 'string' ? form.supportedLocales : ''
    if (typeof form.configJson !== 'string') {
      form.configJson = JSON.stringify(form.configJson || {}, null, 2)
    }
  } else {
    Object.assign(form, {
      id: null,
      name: '',
      code: '',
      iconUrl: '',
      supportedLocales: '',
      configJson: '{}',
      info: '',
      create: '',
      callback: '',
      isActive: false,
    })
  }
  isModalOpen.value = true
}

const closeMethodModal = () => {
  isModalOpen.value = false
}

const saveMethod = async () => {
  // Validate JSON
  try {
    if (form.configJson) JSON.parse(form.configJson)
  } catch (e) {
    toast.add({
      title: t('admin.payments.toast.error'),
      description: t('admin.payments.toast.invalid_json'),
      color: 'error',
    })
    return
  }

  isSaving.value = true
  try {
    const url = form.id
      ? `/api/admin/payments/${form.id}`
      : '/api/admin/payments'
    const method = form.id ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: form,
    })

    isModalOpen.value = false
    await refresh()
    toast.add({
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.saved'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.save_failed'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const toggleActive = async (row: any) => {
  try {
    await $fetch(`/api/admin/payments/${row.id}`, {
      method: 'PUT',
      body: { isActive: row.isActive },
    })
    toast.add({
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.status_updated'),
      color: 'success',
    })
  } catch (e: any) {
    row.isActive = !row.isActive // revert on fail
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.status_failed'),
      color: 'error',
    })
  }
}

const deleteMethod = async (id: number) => {
  const isConfirmed = await confirm({
    title: t('admin.payments.confirm.delete_title'),
    description: t('admin.payments.confirm.delete_desc'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/payments/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.deleted'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.delete_failed'),
      color: 'error',
    })
  }
}

// ---- Failures Tab ----

const failuresColumns = [
  { accessorKey: 'id', header: () => t('admin.payments.failures.id') },
  { accessorKey: 'orderId', header: () => t('admin.payments.failures.orderId') },
  { accessorKey: 'visitorId', header: () => t('admin.payments.failures.visitor') },
  { accessorKey: 'cardBin', header: () => t('admin.payments.failures.cardBin') },
  { accessorKey: 'reason', header: () => t('admin.payments.failures.reason') },
  { accessorKey: 'amount', header: () => t('admin.payments.failures.amount') },
  { accessorKey: 'payMethod', header: () => t('admin.payments.failures.method') },
  { accessorKey: 'createdAt', header: () => t('admin.payments.failures.date') },
  { accessorKey: 'actions', header: () => t('admin.payments.failures.actions') },
]

const failures = ref<any[]>([])
const failuresPending = ref(false)
const isFailuresModalOpen = ref(false)
const selectedFailure = ref<any>(null)

const fetchFailures = async () => {
  failuresPending.value = true
  try {
    const res = await $fetch<any>('/api/admin/payments/failures')
    failures.value = Array.isArray(res) ? res : []
  } catch {
    failures.value = []
  } finally {
    failuresPending.value = false
  }
}

// Load failures data when switching to failures tab
watch(activeTab, (tab) => {
  if (tab === 'failures' && failures.value.length === 0) {
    fetchFailures()
  }
})

const copyVisitorId = (id: string) => {
  if (!id) return
  navigator.clipboard.writeText(id)
  toast.add({
    title: t('admin.payments.failures.copied'),
    description: t('admin.payments.failures.copiedDescription'),
    color: 'success',
  })
}

const viewDetails = (record: any) => {
  selectedFailure.value = record
  isFailuresModalOpen.value = true
}

const closeFailuresModal = () => {
  isFailuresModalOpen.value = false
}

const formatJson = (str: string) => {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
</script>
