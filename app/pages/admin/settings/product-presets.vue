<template>
  <div class="max-w-5xl mx-auto pb-12">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
        <UIcon
          name="ph:list-plus-fill"
          class="w-8 h-8 text-purple-500"
        />
        {{ $t('admin.settings.presets.title') }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.settings.presets.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <AdminSettingsNav
        active="product-presets"
        @select="goToSettingsTab"
      />

      <div class="lg:col-span-9 space-y-6">
        <div
          v-if="!hasAdminPerm('settings:view')"
          class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400"
        >
          {{ $t('admin.settings.presets.no_permission') }}
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-4">
            <UFormField :label="$t('admin.settings.presets.product_type')">
              <USelect
                v-model="activeType"
                :items="typeOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-56"
              />
            </UFormField>
            <UButton
              v-if="hasAdminPerm('settings:edit')"
              size="sm"
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              :loading="isSaving"
              @click="save"
            >{{ $t('admin.common.save') }}</UButton>
          </div>

          <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl p-6">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">{{ $t('admin.settings.presets.help') }}</p>

            <div
              v-if="!currentFields.length"
              class="text-center text-sm text-gray-400 dark:text-gray-500 py-8"
            >
              {{ $t('admin.settings.presets.empty') }}
            </div>

            <div
              v-for="(field, index) in currentFields"
              :key="field.id"
              class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-3 pb-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0"
            >
              <UFormField
                class="md:col-span-3"
                :label="$t('admin.settings.presets.field_name')"
              >
                <UInput
                  v-model="field.name"
                  placeholder="max_items"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                class="md:col-span-3"
                :label="$t('admin.settings.presets.field_label')"
              >
                <UInput
                  v-model="field.label"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                class="md:col-span-2"
                :label="$t('admin.settings.presets.field_type')"
              >
                <USelect
                  v-model="field.type"
                  :items="fieldTypeOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                class="md:col-span-2"
                :label="$t('admin.settings.presets.field_default')"
              >
                <UInput
                  v-model="field.default"
                  class="w-full"
                />
              </UFormField>
              <div class="md:col-span-2 flex items-center gap-3 pb-1">
                <UCheckbox
                  v-model="field.required"
                  :label="$t('admin.settings.presets.field_required')"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="ph:trash"
                  @click="removeField(index)"
                />
              </div>
              <p
                v-if="field.name && !isValidPresetFieldName(field.name)"
                class="md:col-span-12 text-xs text-red-500"
              >
                {{ $t('admin.settings.presets.field_name_invalid') }}
              </p>
            </div>

            <UButton
              v-if="hasAdminPerm('settings:edit')"
              size="sm"
              variant="soft"
              icon="ph:plus"
              class="mt-2"
              @click="addField"
            >{{ $t('admin.settings.presets.add_field') }}</UButton>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta, useI18n, useToast, navigateTo } from '#imports'
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'
import { useAdminPermissions } from '~/composables/useAdminPermissions'
import {
  PRODUCT_META_PRESETS_KEY,
  PRESET_FIELD_TYPES,
  cleanMetaPresets,
  isValidPresetFieldName,
  parseMetaPresets,
} from '~/utils/adminProductFormData'

definePageMeta({ title: 'Product Meta Presets', layout: 'admin' })

const { t } = useI18n()
const toast = useToast()
const { loadAdmin, hasPerm: hasAdminPerm } = useAdminPermissions()
const adminFetch = $fetch as (request: string, options?: Record<string, unknown>) => Promise<any>

const goToSettingsTab = (tabId: string) => {
  if (isSettingsTabId(tabId)) {
    navigateTo({ path: '/admin/settings', query: { tab: tabId } })
  }
}

const typeOptions = computed(() => [
  { label: t('admin.products.form.type_basic'), value: 'basic' },
  { label: t('admin.products.form.type_subscription'), value: 'subscription' },
  { label: t('admin.products.form.type_service'), value: 'service' },
  { label: t('admin.products.form.type_key'), value: 'key' },
  { label: t('admin.products.form.type_file'), value: 'file' },
  { label: t('admin.products.form.type_topup'), value: 'topup' },
])

const fieldTypeOptions = computed(() =>
  PRESET_FIELD_TYPES.map(value => ({ label: t(`admin.settings.presets.type_${value}`), value })),
)

const activeType = ref('subscription')
const presets = ref<Record<string, any[]>>({})
const isSaving = ref(false)

const currentFields = computed(() => {
  if (!presets.value[activeType.value]) presets.value[activeType.value] = []
  return presets.value[activeType.value]!
})

const addField = () => {
  currentFields.value.push({
    id: `${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    label: '',
    type: 'text',
    required: false,
    default: '',
  })
}

const removeField = (index: number) => {
  currentFields.value.splice(index, 1)
}

// 读走 /api/admin/settings（鉴权端点）而不是 useSettings()——后者打的是公开的
// /api/settings，管理页不该依赖公开投影的可见性
const load = async () => {
  try {
    const rows: any[] = await adminFetch('/api/admin/settings')
    const row = Array.isArray(rows) ? rows.find(item => item.key === PRODUCT_META_PRESETS_KEY) : null
    presets.value = parseMetaPresets(row?.value)
  } catch (e) {
    console.error('Failed to load product meta presets', e)
  }
}

const save = async () => {
  isSaving.value = true
  try {
    // 落库前统一清洗:丢弃空名、非法名、保留键与重名,避免存进去一份表单渲染不出来的预设
    const cleaned = cleanMetaPresets(presets.value)
    await adminFetch('/api/admin/settings', {
      method: 'POST',
      body: { [PRODUCT_META_PRESETS_KEY]: JSON.stringify(cleaned) },
    })
    presets.value = parseMetaPresets(JSON.stringify(cleaned))
    toast.add({ title: t('admin.common.save'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.message || 'Failed', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

// 先取管理员身份再读数据:hasAdminPerm 在 admin 载入前一律为假,
// 不等它就会先闪一下「无权限」空态
onMounted(async () => {
  await loadAdmin()
  await load()
})
</script>
