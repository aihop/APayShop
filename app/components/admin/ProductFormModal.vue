<template>
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-6xl"
    :title="form.id ? $t('admin.products.edit') : $t('admin.products.add')"
  >
    <ProductLocaleTabs
      :locales="supportedLocales"
      :default-locale="defaultLocale"
      :current-locale="currentTabLocale"
      :has-default-name="Boolean(form.name)"
      @select="handleLocaleSelect"
    />

    <form
      @submit.prevent="onSubmit"
      class="space-y-6"
      id="product-form"
    >
      <div class="grid grid-cols-2 gap-4">
        <UFormField :label="$t('admin.products.name') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
          <UInput
            v-if="currentTabLocale === defaultLocale"
            v-model="form.name"
            required
            class="text-gray-900 dark:text-white w-full"
          />
          <UInput
            v-else
            v-model="translationForms[currentTabLocale].name"
            class="text-gray-900 dark:text-white w-full"
            :placeholder="$t('admin.products.form.name_translated', { locale: currentTabLocale })"
          />
        </UFormField>
        <UFormField
          :label="$t('admin.products.form.slug')"
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.slug"
            class="text-gray-900 dark:text-white w-full"
            :placeholder="$t('admin.products.form.slug_placeholder')"
          />
        </UFormField>
      </div>

      <div
        class="grid grid-cols-2 gap-4"
        v-if="currentTabLocale === defaultLocale"
      >
        <div class="flex flex-col gap-2">
          <UFormField :label="$t('admin.products.form.type')">
            <USelect
              v-model="form.type"
              :items="typeOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          :label="$t('admin.products.price')"
          name="price"
        >
          <UInput
            v-model.number="form.price"
            type="number"
            step="0.01"
            required
            class="text-gray-900 dark:text-white w-full"
          />
        </UFormField>
      </div>

      <div
        class="grid grid-cols-2 gap-4"
        v-if="currentTabLocale === defaultLocale"
      >
        <UFormField :label="$t('admin.products.form.per_user_limit.label')">
          <UInput
            v-model.number="form.metaData.perUserLimit"
            type="number"
            min="0"
            step="1"
            class="text-gray-900 dark:text-white w-full"
            :placeholder="$t('admin.products.form.per_user_limit.placeholder')"
          />
          <p class="text-xs text-gray-500 mt-1">
            {{ $t('admin.products.form.per_user_limit.help') }}
          </p>
        </UFormField>
      </div>

      <div
        v-if="(form.type === 'subscription' || form.type === 'topup') && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-[#1a1a1c]"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-gray-900 dark:text-white font-medium">{{ form.type === 'subscription' ? $t('admin.products.form.subscription_settings') : $t('admin.products.form.topup_display_settings') }}</h3>
            <UTooltip :text="$t('admin.products.form.pricing_tooltip')">
              <UIcon
                name="ph:info"
                class="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help"
              />
            </UTooltip>
          </div>
          <UCheckbox
            v-model="form.metaData.is_pricing_plan"
            :label="$t('admin.products.form.show_as_pricing')"
            class="shrink-0"
          />
        </div>
        <div
          class="grid grid-cols-2 gap-4"
          v-if="form.type === 'subscription'"
        >
          <UFormField :label="$t('admin.products.form.interval_unit')">
            <USelect
              v-model="form.metaData.interval"
              :items="intervalOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="$t('admin.products.form.interval_count')"
            v-if="form.metaData.interval !== 'lifetime'"
          >
            <UInput
              v-model.number="form.metaData.interval_count"
              type="number"
              min="1"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.interval_placeholder')"
            />
          </UFormField>
        </div>
        <div
          class="grid grid-cols-2 gap-4"
          v-if="form.type === 'topup'"
        >
          <UFormField :label="$t('admin.products.form.recharge_amount')">
            <UInput
              v-model.number="form.metaData.recharge_amount"
              type="number"
              step="0.01"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.recharge_placeholder')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.recharge_help') }}</p>
          </UFormField>
          <UFormField :label="$t('admin.products.form.balance_type')">
            <USelect
              v-model="form.metaData.balance_type"
              :items="balanceTypeOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.balance_help') }}</p>
          </UFormField>
        </div>
      </div>

      <ProductGatewayPlanIdsSection
        :visible="form.type === 'subscription' && currentTabLocale === defaultLocale"
        :items="planIdsList"
        :available-gateways="availableGateways"
        @add="addPlanId"
        @remove="removePlanId"
      />

      <ProductServiceSchemaSection
        :visible="form.type === 'service'"
        :is-default-locale="currentTabLocale === defaultLocale"
        :locale-suffix="currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : ''"
        :is-visual-mode="isServiceSchemaVisualMode"
        :schema-json="serviceFormSchemaStr"
        :schema-list="serviceFormSchemaList"
        :schema-field-type-options="schemaFieldTypeOptions"
        @toggle-mode="toggleServiceSchemaMode"
        @update:schema-json="serviceFormSchemaStr = $event"
        @update:schema-list="serviceFormSchemaList = $event"
        @add-field="addServiceSchemaField"
        @remove-field="removeServiceSchemaField"
      />

      <div
        v-if="form.type === 'file'"
        class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-[#1a1a1c]"
      >
        <h3 class="text-gray-900 dark:text-white font-medium mb-4">{{ $t('admin.products.form.file_settings') }}</h3>

        <div class="grid grid-cols-1 gap-4">
          <UFormField
            :label="$t('admin.products.form.download_url')"
            v-if="currentTabLocale === defaultLocale"
          >
            <UInput
              v-model="form.metaData.download_url"
              class="text-gray-900 dark:text-white w-full"
              placeholder="https://..."
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.download_url_help') }}</p>
          </UFormField>

          <UFormField
            :label="$t('admin.products.form.download_instructions') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
            <UTextarea
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.download_instruction"
              :rows="2"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.download_placeholder')"
            />
            <UTextarea
              v-else
              v-model="translationForms[currentTabLocale].download_instruction"
              :rows="2"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.download_translated', { locale: currentTabLocale })"
            />
          </UFormField>
        </div>
      </div>

      <div
        v-if="form.type === 'topup' && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-[#1a1a1c]"
      >
        <h3 class="text-gray-900 dark:text-white font-medium mb-4">{{ $t('admin.products.form.topup_settings') }}</h3>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('admin.products.form.success_message')">
            <UInput
              v-model="form.metaData.delivery_message"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.success_placeholder')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.success_help') }}</p>
          </UFormField>

          <UFormField :label="$t('admin.products.form.display_unit')">
            <UInput
              v-model="form.metaData.display_unit"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.display_placeholder')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.display_help') }}</p>
          </UFormField>
        </div>
      </div>

      <ProductPricingFeaturesSection
        :visible="form.type === 'subscription' || form.type === 'topup'"
        :locale="currentTabLocale"
        :is-visual-mode="isFeaturesVisualMode"
        :features-json="currentFeaturesJson"
        :features-list="currentFeaturesList"
        @toggle-mode="toggleFeaturesMode"
        @update:features-json="currentFeaturesJson = $event"
        @update:features-list="currentFeaturesList = $event"
        @add-feature="addFeature"
        @remove-feature="removeFeature"
      >
        <template #badge-field>
          <UFormField
            v-if="form.metaData.is_pricing_plan"
            :label="$t('admin.products.form.plan_badge', { locale: currentTabLocale })"
          >
            <UInput
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.plan_badge"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.plan_badge_placeholder')"
            />
            <UInput
              v-else
              v-model="translationForms[currentTabLocale].plan_badge"
              class="text-gray-900 dark:text-white w-full"
              :placeholder="$t('admin.products.form.badge_translated', { locale: currentTabLocale })"
            />
          </UFormField>
        </template>
        <template #color-field>
          <UFormField
            v-if="currentTabLocale === defaultLocale && form.metaData.is_pricing_plan"
            :label="$t('admin.products.form.highlight_color')"
          >
            <USelect
              v-model="form.metaData.plan_color"
              class="min-w-[200px]"
              :items="highlightColorOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>
        </template>
      </ProductPricingFeaturesSection>

      <ProductImagesField
        :visible="currentTabLocale === defaultLocale"
        :images="form.imageUrls"
        :new-image-url="newImageUrl"
        :is-uploading="isUploading"
        @update:new-image-url="newImageUrl = $event"
        @update:images="form.imageUrls = $event"
        @add-url="addImageUrl"
        @upload="onFileUpload"
        @preview="previewImage"
        @remove="removeImage"
      />

      <UFormField :label="$t('admin.products.form.description') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
        <UTextarea
          v-if="currentTabLocale === defaultLocale"
          v-model="form.description"
          :rows="3"
          class="text-gray-900 dark:text-white w-full"
        />
        <UTextarea
          v-else
          v-model="translationForms[currentTabLocale].description"
          :rows="3"
          class="text-gray-900 dark:text-white w-full"
          :placeholder="$t('admin.products.form.description_translated', { locale: currentTabLocale })"
        />
      </UFormField>

      <UFormField :label="$t('admin.products.form.content') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
        <RichEditor
          v-if="currentTabLocale === defaultLocale"
          v-model="form.content"
        />
        <RichEditor
          v-else
          v-model="translationForms[currentTabLocale].content"
        />
      </UFormField>

      <div
        class="flex items-center gap-6 mt-4 pb-8"
        v-if="currentTabLocale === defaultLocale"
      >
        <UCheckbox
          v-model="form.isActive"
          :label="$t('admin.products.active')"
        />
      </div>
    </form>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="isOpen = false"
      >{{ $t('admin.common.cancel') }}</UButton>
      <UButton
        type="submit"
        form="product-form"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        :loading="isSaving"
      >{{ $t('admin.common.save') }}</UButton>
    </template>
  </FullScreenModal>
  <!-- Image Preview Modal -->
  <UModal v-model:open="isPreviewModalOpen">
    <template #content>
      <div class="relative bg-white dark:bg-black/90 p-2 rounded-lg flex justify-center items-center">
        <UButton
          color="neutral"
          variant="ghost"
          icon="ph:x"
          class="absolute top-4 right-4 z-10 bg-white/80 dark:bg-black/50 hover:bg-gray-100 dark:hover:bg-black/70 rounded-full"
          @click="isPreviewModalOpen = false"
        />
        <img
          :src="previewImageUrl"
          class="max-w-full max-h-[85vh] object-contain rounded"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
// 显式 import:这些组件在 components/admin/products/ 子目录下,Nuxt 自动导入会带
// 路径前缀(<AdminProductsProductPricingFeaturesSection>),模板里用短名解析不到,
// 表现为「订阅/充值的套餐特性、服务表单、图片字段等整块 UI 静默不渲染」
import ProductGatewayPlanIdsSection from './products/ProductGatewayPlanIdsSection.vue'
import ProductImagesField from './products/ProductImagesField.vue'
import ProductLocaleTabs from './products/ProductLocaleTabs.vue'
import ProductPricingFeaturesSection from './products/ProductPricingFeaturesSection.vue'
import ProductServiceSchemaSection from './products/ProductServiceSchemaSection.vue'
import { useAdminProductForm } from '~/composables/useAdminProductForm'

const props = defineProps<{
  modelValue: boolean
  product?: any
}>()

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const {
  form,
  translationForms,
  isSaving,
  isUploading,
  newImageUrl,
  serviceFormSchemaStr,
  serviceFormSchemaList,
  isServiceSchemaVisualMode,
  toggleServiceSchemaMode,
  addServiceSchemaField,
  removeServiceSchemaField,
  isFeaturesVisualMode,
  currentFeaturesJson,
  toggleFeaturesMode,
  currentFeaturesList,
  supportedLocales,
  defaultLocale,
  currentTabLocale,
  initForm,
  saveProduct,
  onTabChange,
  addFeature,
  removeFeature,
  handleFileUpload,
  addImageUrl,
  removeImage,
  planIdsList,
  availableGateways,
  addPlanId,
  removePlanId,
} = useAdminProductForm(emit)

const typeOptions = computed(() => [
  { label: t('admin.products.form.type_basic'), value: 'basic' },
  { label: t('admin.products.form.type_subscription'), value: 'subscription' },
  { label: t('admin.products.form.type_service'), value: 'service' },
  { label: t('admin.products.form.type_key'), value: 'key' },
  { label: t('admin.products.form.type_file'), value: 'file' },
  { label: t('admin.products.form.type_topup'), value: 'topup' },
])

const intervalOptions = computed(() => [
  { label: t('admin.products.form.interval_day'), value: 'day' },
  { label: t('admin.products.form.interval_week'), value: 'week' },
  { label: t('admin.products.form.interval_month'), value: 'month' },
  { label: t('admin.products.form.interval_year'), value: 'year' },
  { label: t('admin.products.form.interval_lifetime'), value: 'lifetime' },
])

const schemaFieldTypeOptions = computed(() => [
  { label: t('admin.products.form.field_type_text'), value: 'text' },
  { label: t('admin.products.form.field_type_number'), value: 'number' },
  { label: t('admin.products.form.field_type_email'), value: 'email' },
  { label: t('admin.products.form.field_type_textarea'), value: 'textarea' },
  { label: t('admin.products.form.field_type_date'), value: 'date' },
])

const balanceTypeOptions = computed(() => [
  { label: t('admin.products.form.balance_cash'), value: 'cash' },
  { label: t('admin.products.form.balance_grant'), value: 'grant' },
])

const highlightColorOptions = computed(() => [
  { label: t('admin.products.form.color_gray'), value: 'gray' },
  { label: t('admin.products.form.color_purple'), value: 'purple' },
  { label: t('admin.products.form.color_blue'), value: 'blue' },
  { label: t('admin.products.form.color_emerald'), value: 'emerald' },
])

const isPreviewModalOpen = ref(false)
const previewImageUrl = ref('')

const previewImage = (url: string) => {
  previewImageUrl.value = url
  isPreviewModalOpen.value = true
}

const onFileUpload = (e: Event, input: HTMLInputElement | null) => {
  handleFileUpload(e, input)
}

const handleLocaleSelect = (locale: string) => {
  const index = supportedLocales.value.indexOf(locale)

  if (index === -1) {
    currentTabLocale.value = locale
    return
  }

  onTabChange(index)
}

const onSubmit = async () => {
  const success = await saveProduct()
  if (success) {
    isOpen.value = false
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      currentTabLocale.value = defaultLocale.value
      initForm(props.product)
    }
  }
)
</script>
