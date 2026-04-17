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
            :placeholder="`Translated name in ${currentTabLocale}`"
          />
        </UFormField>
        <UFormField
          label="Slug (Optional)"
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.slug"
            class="text-white w-full"
            placeholder="Auto-generated if left empty"
          />
        </UFormField>
      </div>

      <div
        class="grid grid-cols-2 gap-4"
        v-if="currentTabLocale === defaultLocale"
      >
        <div class="flex flex-col gap-2">
          <UFormField label="Type">
            <USelect
              v-model="form.type"
              :items="[
                  { label: 'Basic (No extra data)', value: 'basic' },
                  { label: 'Subscription (Recurring)', value: 'subscription' },
                  { label: 'Service (Manual fulfillment)', value: 'service' },
                  { label: 'Key (One item per code)', value: 'key' },
                  { label: 'File (Download link)', value: 'file' },
                  { label: 'Dynamic API (Quota)', value: 'dynamic_api' }
                ]"
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
        v-if="(form.type === 'subscription' || form.type === 'dynamic_api') && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-white font-medium">{{ form.type === 'subscription' ? 'Subscription Settings' : 'Display Settings' }}</h3>
            <UTooltip text="Check this to display the product on the frontend Pricing Page and Homepage">
              <UIcon
                name="ph:info"
                class="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help"
              />
            </UTooltip>
          </div>
          <UCheckbox
            v-model="form.metaData.is_pricing_plan"
            label="Show as Pricing Plan on Frontend"
            class="shrink-0"
          />
        </div>
        <div
          class="grid grid-cols-2 gap-4"
          v-if="form.type === 'subscription'"
        >
          <UFormField label="Interval Unit">
            <USelect
              v-model="form.metaData.interval"
              :items="[
                  { label: 'Day', value: 'day' },
                  { label: 'Week', value: 'week' },
                  { label: 'Month', value: 'month' },
                  { label: 'Year', value: 'year' },
                  { label: 'Lifetime', value: 'lifetime' }
                ]"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Interval Count"
            v-if="form.metaData.interval !== 'lifetime'"
          >
            <UInput
              v-model.number="form.metaData.interval_count"
              type="number"
              min="1"
              class="text-white w-full"
              placeholder="e.g., 1"
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
            Gateway Plan IDs
          </h3>
        </div>
        <p class="text-xs text-gray-400 mb-4">Map this product to external subscription plan IDs (e.g. PayPal plan_id, Stripe price_id).</p>
        <div class="space-y-3">
          <div
            v-for="(item, index) in planIdsList"
            :key="index"
            class="flex items-center gap-3"
          >
            <USelect
              v-model="item.gateway"
              :items="availableGateways"
              placeholder="Select Gateway"
              class="w-1/3"
            />
            <UInput
              v-model="item.id"
              placeholder="Plan/Price ID (e.g. P-12345)"
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
            Add Gateway Mapping
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
            Service Settings {{ currentTabLocale !== defaultLocale ? `(${currentTabLocale} Labels)` : '' }}
          </h3>
          <UButton
            v-if="currentTabLocale === defaultLocale"
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="isServiceSchemaVisualMode ? 'ph:code' : 'ph:eye'"
            @click="toggleServiceSchemaMode"
          >
            {{ isServiceSchemaVisualMode ? 'Edit Raw JSON' : 'Visual Builder' }}
          </UButton>
        </div>

        <!-- 默认语言的完整表单设计器 -->
        <div
          v-if="currentTabLocale === defaultLocale"
          class="grid grid-cols-1 gap-4"
        >
          <UFormField label="Required User Info Form Schema">
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
                          placeholder="Field Name (e.g. server_ip)"
                          class="text-white"
                        />
                      </div>

                      <UInput
                        v-model="element.label"
                        placeholder="Display Label"
                        class="text-white flex-1"
                      />

                      <div class="w-32">
                        <USelect
                          v-model="element.type"
                          :items="[
                              { label: 'Text', value: 'text' },
                              { label: 'Number', value: 'number' },
                              { label: 'Email', value: 'email' },
                              { label: 'Textarea', value: 'textarea' },
                              { label: 'Date', value: 'date' }
                            ]"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-full"
                        />
                      </div>

                      <div class="flex items-center gap-3 ml-2">
                        <UCheckbox
                          v-model="element.required"
                          label="Required"
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
                  No form fields defined.
                </div>

                <UButton
                  color="neutral"
                  variant="outline"
                  icon="ph:plus"
                  size="sm"
                  class="w-full justify-center border-dashed"
                  @click="addServiceSchemaField"
                >
                  Add Form Field
                </UButton>
              </template>

              <!-- Raw JSON Mode -->
              <template v-else>
                <UTextarea
                  v-model="serviceFormSchemaStr"
                  :rows="10"
                  class="font-mono text-sm text-white w-full"
                  placeholder='[\n  {\n    "name": "field_name",\n    "label": "Display Label",\n    "type": "text",\n    "required": true\n  }\n]'
                />
                <p class="text-xs text-gray-500 mt-2">
                  Must be a valid JSON array of objects containing 'name', 'label', 'type', and 'required'.
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
        <h3 class="text-white font-medium mb-4">File Download Settings</h3>

        <div class="grid grid-cols-1 gap-4">
          <UFormField
            label="Download URL"
            v-if="currentTabLocale === defaultLocale"
          >
            <UInput
              v-model="form.metaData.download_url"
              class="text-white w-full"
              placeholder="https://..."
            />
            <p class="text-xs text-gray-500 mt-1">The secure link where users can download the file after purchase (e.g., Google Drive, AWS S3, or your own server).</p>
          </UFormField>

          <UFormField :label="`Download Instructions / Password (Optional)` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
            <UTextarea
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.download_instruction"
              :rows="2"
              class="text-white w-full"
              placeholder="e.g., Unzip password is: 123456"
            />
            <UTextarea
              v-else
              v-model="translationForms[currentTabLocale].download_instruction"
              :rows="2"
              class="text-white w-full"
              :placeholder="`Translated instruction in ${currentTabLocale}`"
            />
          </UFormField>
        </div>
      </div>

      <div
        v-if="form.type === 'dynamic_api' && currentTabLocale === defaultLocale"
        class="p-4 border border-gray-800 rounded-lg bg-[#1a1a1c]"
      >
        <h3 class="text-white font-medium mb-4">Dynamic API Settings</h3>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <UFormField label="Quota Limit">
            <UInput
              v-model.number="form.metaData.quota"
              type="number"
              class="text-white w-full"
              placeholder="e.g., 100000"
            />
            <p class="text-xs text-gray-500 mt-1">Number of Credits / Tokens / Requests</p>
          </UFormField>

          <UFormField label="Valid Days (Optional)">
            <UInput
              v-model.number="form.metaData.valid_days"
              type="number"
              class="text-white w-full"
              placeholder="e.g., 30"
            />
            <p class="text-xs text-gray-500 mt-1">Days until the key expires. Leave empty for no expiration.</p>
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <UFormField label="Allowed Scopes (Optional)">
            <div class="w-full flex flex-col gap-2">
              <UInput
                v-model="newScopeInput"
                class="text-white w-full"
                placeholder="Type scope and press enter..."
                @keydown.enter.prevent="addScope"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    icon="ph:plus"
                    :padded="false"
                    @click="addScope"
                  />
                </template>
              </UInput>
              <div
                v-if="form.metaData.allowed_scopes && form.metaData.allowed_scopes.length > 0"
                class="flex flex-wrap gap-2 mt-1"
              >
                <UBadge
                  v-for="(scope, index) in form.metaData.allowed_scopes"
                  :key="index"
                  color="neutral"
                  variant="solid"
                  class="bg-gray-800 text-gray-200"
                >
                  {{ scope }}
                  <UButton
                    color="neutral"
                    variant="link"
                    icon="ph:x"
                    size="xs"
                    :padded="false"
                    class="ml-1 text-gray-400 hover:text-white"
                    @click="removeScope(index)"
                  />
                </UBadge>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Define permissions, models, or endpoints.</p>
          </UFormField>

          <UFormField label="API Endpoint (Base URL for user)">
            <UInput
              v-model="form.metaData.api_endpoint"
              class="text-white w-full"
              placeholder="https://api.example.com/v1"
            />
            <p class="text-xs text-gray-500 mt-1">The base URL displayed to the user after purchase.</p>
          </UFormField>
        </div>

        <div class="pt-4 border-t border-gray-800">
          <h4 class="text-sm font-medium text-gray-300 mb-3">Backend Sync (Webhook)</h4>
          <p class="text-xs text-gray-500 mb-4">Automatically push the generated API Key and Quota to your external service when an order is paid.</p>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Sync Webhook URL">
              <UInput
                v-model="form.metaData.sync_webhook_url"
                class="text-white w-full"
                placeholder="https://your-service.com/api/sync-key"
              />
            </UFormField>
            <UFormField label="Sync Secret (For HMAC signature)">
              <UInput
                v-model="form.metaData.sync_secret"
                type="password"
                class="text-white w-full"
                placeholder="Optional secret key"
              />
            </UFormField>
          </div>
        </div>
      </div>

      <div
        v-if="form.type === 'subscription' || form.type === 'dynamic_api' && form.metaData.is_pricing_plan"
        class="p-4 border border-purple-500/30 rounded-lg bg-[#2a1a3a]/30 mt-4"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-medium flex items-center gap-2">
            <UIcon
              name="ph:star-fill"
              class="text-purple-400"
            />
            Pricing Plan Features
          </h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="isFeaturesVisualMode ? 'ph:code' : 'ph:eye'"
            @click="toggleFeaturesMode"
          >
            {{ isFeaturesVisualMode ? 'Edit Raw JSON' : 'Visual Builder' }}
          </UButton>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <UFormField :label="`Features (${currentTabLocale})`">
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
                          placeholder="Icon (e.g. ph:check)"
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
                        placeholder="Feature description"
                        class="text-white flex-1"
                      />

                      <div class="flex items-center gap-3 ml-2">
                        <UCheckbox
                          v-model="element.included"
                          label="Included"
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
                  No features defined for this language.
                </div>

                <UButton
                  color="neutral"
                  variant="outline"
                  icon="ph:plus"
                  size="sm"
                  class="w-full justify-center border-dashed"
                  @click="addFeature"
                >
                  Add Feature Row
                </UButton>
              </template>

              <!-- Raw JSON Mode -->
              <template v-else>
                <UTextarea
                  v-model="currentFeaturesJson"
                  :rows="10"
                  class="font-mono text-sm text-white w-full"
                  placeholder='[\n  {\n    "name": "Feature name",\n    "icon": "ph:check",\n    "included": true\n  }\n]'
                />
                <p class="text-xs text-gray-500 mt-2">
                  Must be a valid JSON array of objects containing 'name', 'icon', and 'included' properties.
                </p>
              </template>
            </div>
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <UFormField :label="`Plan Badge (${currentTabLocale}) (Optional)`">
            <UInput
              v-if="currentTabLocale === defaultLocale"
              v-model="form.metaData.plan_badge"
              class="text-white w-full"
              placeholder="e.g., Most Popular"
            />
            <UInput
              v-else
              v-model="translationForms[currentTabLocale].plan_badge"
              class="text-white w-full"
              :placeholder="`Translated badge in ${currentTabLocale}`"
            />
          </UFormField>
          <UFormField
            label="Highlight Color"
            v-if="currentTabLocale === defaultLocale"
          >
            <USelect
              v-model="form.metaData.plan_color"
              class="min-w-[200px]"
              :items="[
                  { label: 'Default (Gray)', value: 'gray' },
                  { label: 'Purple (Primary)', value: 'purple' },
                  { label: 'Blue', value: 'blue' },
                  { label: 'Emerald', value: 'emerald' }
                ]"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>
        </div>
      </div>

      <UFormField
        label="Images"
        v-if="currentTabLocale === defaultLocale"
      >
        <div class="flex flex-col gap-4 w-full">
          <div class="flex gap-2 w-full">
            <UInput
              v-model="newImageUrl"
              class="text-white flex-1"
              placeholder="https://... or upload local images"
              @keyup.enter.prevent="addImageUrl"
            />
            <UButton
              color="primary"
              variant="outline"
              @click="addImageUrl"
              :disabled="!newImageUrl"
            >
              Add URL
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="ph:upload-simple"
              :loading="isUploading"
              @click="fileInput?.click()"
            >
              Upload
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

      <UFormField :label="`Description (Short)` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
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
          :placeholder="`Translated description in ${currentTabLocale}`"
        />
      </UFormField>

      <UFormField :label="`Detailed Content (HTML/Markdown)` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')">
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
  <UModal v-model="isPreviewModalOpen">
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
  newScopeInput,
  addScope,
  removeScope,
  planIdsList,
  availableGateways,
  addPlanId,
  removePlanId,
} = useAdminProductForm(emit)

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
      // Force tab to default locale
      currentTabLocale.value = defaultLocale.value
      // Initialize form
      initForm(props.product)
    }
  }
)
</script>
