<template>
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-6xl"
    :title="form.id ? $t('admin.products.edit') : $t('admin.products.add')"
  >
    <!-- Language Tabs -->
    <div
      v-if="supportedLocales.length > 1"
      class="border-b border-gray-800/60 bg-[#121214] mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6"
    >
      <nav class="flex space-x-2 overflow-x-auto hide-scrollbar pb-2">
        <button
          v-for="locale in supportedLocales"
          :key="locale"
          type="button"
          @click="() => {
            if (locale !== defaultLocale && !form.name) return;
            currentTabLocale = locale;
          }"
          :class="[
            'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            currentTabLocale === locale
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              : locale !== defaultLocale && !form.name
                ? 'text-gray-600 cursor-not-allowed border border-transparent'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
          ]"
          :disabled="locale !== defaultLocale && !form.name"
        >
          <UIcon
            :name="locale === defaultLocale ? 'ph:star-fill' : 'ph:translate'"
            :class="[
              'w-4 h-4',
              locale === defaultLocale ? 'text-yellow-500' : ''
            ]"
          />
          {{ locale.toUpperCase() }}
        </button>
      </nav>
    </div>

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
            class="text-white w-full"
          />
          <UInput
            v-else
            v-model="translationForms[currentTabLocale].name"
            class="text-white w-full"
            :placeholder="$t('admin.products.form.name_translated', { locale: currentTabLocale })"
          />
        </UFormField>
        <UFormField
          :label="$t('admin.products.form.slug')"
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.slug"
            class="text-white w-full"
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
            class="text-white w-full"
          />
        </UFormField>
      </div>

      <div
        v-if="(form.type === 'subscription' || form.type === 'topup') && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-white font-medium">{{ form.type === 'subscription' ? $t('admin.products.form.subscription_settings') : $t('admin.products.form.topup_display_settings') }}</h3>
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
              class="text-white w-full"
              :placeholder="$t('admin.products.form.interval_placeholder')"
            />
          </UFormField>
        </div>
      </div>

      <!-- Gateway Plan IDs (仅限默认语言) -->
      <div
        v-if="form.type === 'subscription' && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c] mt-4"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-medium flex items-center gap-2">
            <UIcon
              name="ph:plugs-connected"
              class="text-green-400"
            />
            {{ $t('admin.products.form.gateway_plan_ids') }}
          </h3>
        </div>
        <p class="text-xs text-gray-400 mb-4">{{ $t('admin.products.form.gateway_description') }}</p>
        <div class="space-y-3">
          <div
            v-for="(item, index) in planIdsList"
            :key="index"
            class="flex items-center gap-3"
          >
            <USelect
              v-model="item.gateway"
              :items="availableGateways"
              :placeholder="$t('admin.products.form.select_gateway')"
              class="w-1/3"
            />
            <UInput
              v-model="item.id"
              :placeholder="$t('admin.products.form.plan_id_placeholder')"
              class="flex-1 text-white"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="ph:trash"
              @click="removePlanId(index)"
            />
          </div>
          <UButton
            color="neutral"
            variant="outline"
            icon="ph:plus"
            size="sm"
            class="w-full border-dashed"
            @click="addPlanId"
          >
            {{ $t('admin.products.form.add_gateway_mapping') }}
          </UButton>
        </div>
      </div>

      <div
        v-if="form.type === 'service'"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-medium flex items-center gap-2">
            <UIcon
              name="ph:list-dashes"
              class="text-blue-400"
            />
            {{ $t('admin.products.form.service_settings') }}{{ currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '' }}
          </h3>
          <UButton
            v-if="currentTabLocale === defaultLocale"
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="isServiceSchemaVisualMode ? 'ph:code' : 'ph:eye'"
            @click="toggleServiceSchemaMode"
          >
            {{ isServiceSchemaVisualMode ? $t('admin.products.form.edit_raw_json') : $t('admin.products.form.visual_builder') }}
          </UButton>
        </div>

        <!-- 默认语言的完整表单设计器 -->
        <div
          v-if="currentTabLocale === defaultLocale"
          class="grid grid-cols-1 gap-4"
        >
          <UFormField :label="$t('admin.products.form.form_schema')">
            <div class="w-full space-y-3">
              <!-- Visual Builder Mode -->
              <template v-if="isServiceSchemaVisualMode">
                <draggable
                  v-if="serviceFormSchemaList.length > 0"
                  v-model="serviceFormSchemaList"
                  item-key="id"
                  handle=".drag-handle"
                  ghost-class="opacity-50 bg-gray-800"
                  animation="200"
                  class="space-y-2"
                >
                  <template #item="{ element, index }">
                    <div class="flex items-center gap-3 p-3 bg-[#1e1e20] border border-gray-800 rounded-lg group">
                      <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                        <UIcon
                          name="ph:dots-six-vertical"
                          class="w-5 h-5"
                        />
                      </div>

                      <div class="w-40">
                        <UInput
                          v-model="element.name"
                          :placeholder="$t('admin.products.form.field_name_placeholder')"
                          class="text-white"
                        />
                      </div>

                      <UInput
                        v-model="element.label"
                        :placeholder="$t('admin.products.form.field_label_placeholder')"
                        class="text-white flex-1"
                      />

                      <div class="w-32">
                        <USelect
                          v-model="element.type"
                          :items="schemaFieldTypeOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-full"
                        />
                      </div>

                      <div class="flex items-center gap-3 ml-2">
                        <UCheckbox
                          v-model="element.required"
                          :label="$t('admin.products.form.field_required')"
                          :ui="{ label: 'text-sm' }"
                        />

                        <UButton
                          color="error"
                          variant="ghost"
                          icon="ph:trash"
                          size="sm"
                          class="opacity-0 group-hover:opacity-100 transition-opacity"
                          @click="removeServiceSchemaField(index)"
                        />
                      </div>
                    </div>
                  </template>
                </draggable>

                <div
                  v-else
                  class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-800 rounded-lg text-center"
                >
                  {{ $t('admin.products.form.no_fields') }}
                </div>

                <UButton
                  color="neutral"
                  variant="outline"
                  icon="ph:plus"
                  size="sm"
                  class="w-full justify-center border-dashed"
                  @click="addServiceSchemaField"
                >
                  {{ $t('admin.products.form.add_field') }}
                </UButton>
              </template>

              <!-- Raw JSON Mode -->
              <template v-else>
                <UTextarea
                  v-model="serviceFormSchemaStr"
                  :rows="10"
                  class="font-mono text-sm text-white w-full"
                  :placeholder="$t('admin.products.form.schema_json_placeholder')"
                />
                <p class="text-xs text-gray-500 mt-2">
                  {{ $t('admin.products.form.schema_json_help') }}
                </p>
              </template>
            </div>
          </UFormField>
        </div>
      </div>

      <div
        v-if="form.type === 'file'"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <h3 class="text-white font-medium mb-4">{{ $t('admin.products.form.file_settings') }}</h3>

        <div class="grid grid-cols-1 gap-4">
          <UFormField
            :label="$t('admin.products.form.download_url')"
            v-if="currentTabLocale === defaultLocale"
          >
            <UInput
              v-model="form.metaData.download_url"
              class="text-white w-full"
              placeholder="https://..."
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.download_url_help') }}</p>
          </UFormField>

          <UFormField :label="$t('admin.products.form.download_instructions') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
            <UTextarea
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.download_instruction"
              :rows="2"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.download_placeholder')"
            />
            <UTextarea
              v-else
              v-model="translationForms[currentTabLocale].download_instruction"
              :rows="2"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.download_translated', { locale: currentTabLocale })"
            />
          </UFormField>
        </div>
      </div>

      <div
        v-if="form.type === 'topup' && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <h3 class="text-white font-medium mb-4">{{ $t('admin.products.form.topup_settings') }}</h3>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <UFormField :label="$t('admin.products.form.recharge_amount')">
            <UInput
              v-model.number="form.metaData.recharge_amount"
              type="number"
              step="0.01"
              class="text-white w-full"
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

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('admin.products.form.success_message')">
            <UInput
              v-model="form.metaData.delivery_message"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.success_placeholder')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.success_help') }}</p>
          </UFormField>

          <UFormField :label="$t('admin.products.form.display_unit')">
            <UInput
              v-model="form.metaData.display_unit"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.display_placeholder')"
            />
            <p class="text-xs text-gray-500 mt-1">{{ $t('admin.products.form.display_help') }}</p>
          </UFormField>
        </div>
      </div>

      <div
        v-if="(form.type === 'subscription' || form.type === 'topup') && form.metaData.is_pricing_plan"
        class="p-4 border border-purple-500/30 rounded-lg bg-[#2a1a3a]/30 mt-4"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-medium flex items-center gap-2">
            <UIcon
              name="ph:star-fill"
              class="text-purple-400"
            />
            {{ $t('admin.products.form.features_title') }}
          </h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="isFeaturesVisualMode ? 'ph:code' : 'ph:eye'"
            @click="toggleFeaturesMode"
          >
            {{ isFeaturesVisualMode ? $t('admin.products.form.edit_raw_json') : $t('admin.products.form.visual_builder') }}
          </UButton>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <UFormField :label="$t('admin.products.form.features_label', { locale: currentTabLocale })">
            <div class="w-full space-y-3">
              <!-- Visual Builder Mode -->
              <template v-if="isFeaturesVisualMode">
                <draggable
                  v-if="currentFeaturesList.length > 0"
                  v-model="currentFeaturesList"
                  item-key="id"
                  handle=".drag-handle"
                  ghost-class="opacity-50 bg-gray-800"
                  animation="200"
                  class="space-y-2"
                >
                  <template #item="{ element, index }">
                    <div class="flex items-center gap-3 p-3 bg-[#1e1e20] border border-gray-800 rounded-lg group">
                      <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                        <UIcon
                          name="ph:dots-six-vertical"
                          class="w-5 h-5"
                        />
                      </div>

                      <div class="w-48">
                        <UInput
                          v-model="element.icon"
                          :placeholder="$t('admin.products.form.feature_icon_placeholder')"
                          class="text-white"
                        >
                          <template #leading>
                            <UIcon
                              :name="element.icon || 'ph:check'"
                              class="w-4 h-4 text-gray-400"
                            />
                          </template>
                        </UInput>
                      </div>

                      <UInput
                        v-model="element.name"
                        :placeholder="$t('admin.products.form.feature_desc_placeholder')"
                        class="text-white flex-1"
                      />

                      <div class="flex items-center gap-3 ml-2">
                        <UCheckbox
                          v-model="element.included"
                          :label="$t('admin.products.form.feature_included')"
                          :ui="{ label: 'text-sm' }"
                        />

                        <UButton
                          color="error"
                          variant="ghost"
                          icon="ph:trash"
                          size="sm"
                          class="opacity-0 group-hover:opacity-100 transition-opacity"
                          @click="removeFeature(index)"
                        />
                      </div>
                    </div>
                  </template>
                </draggable>

                <div
                  v-else
                  class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-800 rounded-lg text-center"
                >
                  {{ $t('admin.products.form.no_features') }}
                </div>

                <UButton
                  color="neutral"
                  variant="outline"
                  icon="ph:plus"
                  size="sm"
                  class="w-full justify-center border-dashed"
                  @click="addFeature"
                >
                  {{ $t('admin.products.form.add_feature') }}
                </UButton>
              </template>

              <!-- Raw JSON Mode -->
              <template v-else>
                <UTextarea
                  v-model="currentFeaturesJson"
                  :rows="10"
                  class="font-mono text-sm text-white w-full"
                  :placeholder="$t('admin.products.form.features_json_placeholder')"
                />
                <p class="text-xs text-gray-500 mt-2">
                  {{ $t('admin.products.form.features_json_help') }}
                </p>
              </template>
            </div>
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <UFormField :label="$t('admin.products.form.plan_badge', { locale: currentTabLocale })">
            <UInput
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.plan_badge"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.plan_badge_placeholder')"
            />
            <UInput
              v-else
              v-model="translationForms[currentTabLocale].plan_badge"
              class="text-white w-full"
              :placeholder="$t('admin.products.form.badge_translated', { locale: currentTabLocale })"
            />
          </UFormField>
          <UFormField
            :label="$t('admin.products.form.highlight_color')"
            v-if="currentTabLocale === defaultLocale"
          >
            <USelect
              v-model="form.metaData.plan_color"
              class="min-w-[200px]"
              :items="highlightColorOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>
        </div>
      </div>

      <UFormField
        :label="$t('admin.products.form.images')"
        v-if="currentTabLocale === defaultLocale"
      >
        <div class="flex flex-col gap-4 w-full">
          <div class="flex gap-2 w-full">
            <UInput
              v-model="newImageUrl"
              class="text-white flex-1"
              :placeholder="$t('admin.products.form.image_url_placeholder')"
              @keyup.enter.prevent="addImageUrl"
            />
            <UButton
              color="primary"
              variant="outline"
              @click="addImageUrl"
              :disabled="!newImageUrl"
            >
              {{ $t('admin.products.form.add_url') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="ph:upload-simple"
              :loading="isUploading"
              @click="fileInput?.click()"
            >
              {{ $t('admin.products.form.upload') }}
            </UButton>
            <input
              type="file"
              ref="fileInput"
              class="hidden"
              multiple
              accept="image/png, image/jpeg, image/webp, image/gif"
              @change="onFileUpload"
            />
          </div>

          <draggable
            v-if="form.imageUrls && form.imageUrls.length > 0"
            v-model="form.imageUrls"
            item-key="url"
            class="flex flex-wrap gap-4 mt-2"
            ghost-class="opacity-50"
            animation="200"
          >
            <template #item="{ element, index }">
              <div class="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-800 group cursor-move">
                <img
                  :src="element"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <UButton
                    color="primary"
                    variant="ghost"
                    icon="ph:eye"
                    size="sm"
                    @click.stop="previewImage(element)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="ph:trash"
                    size="sm"
                    @click.stop="removeImage(index)"
                  />
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </UFormField>

      <UFormField :label="$t('admin.products.form.description') + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
        <UTextarea
          v-if="currentTabLocale === defaultLocale"
          v-model="form.description"
          :rows="3"
          class="text-white w-full"
        />
        <UTextarea
          v-else
          v-model="translationForms[currentTabLocale].description"
          :rows="3"
          class="text-white w-full"
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
      <div class="relative bg-black/90 p-2 rounded-lg flex justify-center items-center">
        <UButton
          color="neutral"
          variant="ghost"
          icon="ph:x"
          class="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full"
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
import draggable from 'vuedraggable'
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

const fileInput = ref<HTMLInputElement | null>(null)
const isPreviewModalOpen = ref(false)
const previewImageUrl = ref('')

const previewImage = (url: string) => {
  previewImageUrl.value = url
  isPreviewModalOpen.value = true
}

const onFileUpload = (e: Event) => {
  handleFileUpload(e, fileInput.value)
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
