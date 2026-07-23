<template>
  <div
    v-if="visible"
    class="p-4 border border-purple-500/30 rounded-lg bg-purple-50/80 dark:bg-[#2a1a3a]/30 mt-4"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-gray-900 dark:text-white font-medium flex items-center gap-2">
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
        :icon="isVisualMode ? 'ph:code' : 'ph:eye'"
        @click="emit('toggle-mode')"
      >
        {{ isVisualMode ? $t('admin.products.form.edit_raw_json') : $t('admin.products.form.visual_builder') }}
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-4">
      <UFormField :label="$t('admin.products.form.features_label', { locale })">
        <div class="w-full space-y-3">
          <template v-if="isVisualMode">
            <draggable
              v-if="featuresList.length > 0"
              v-model="featuresListModel"
              item-key="id"
              handle=".drag-handle"
              ghost-class="opacity-50 bg-gray-200 dark:bg-gray-800"
              animation="200"
              class="space-y-2"
            >
              <template #item="{ element, index }">
                <div class="flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#1e1e20] border border-gray-200 dark:border-gray-800 rounded-lg group">
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
                      class="text-gray-900 dark:text-white"
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
                    class="text-gray-900 dark:text-white flex-1"
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
                      @click="emit('remove-feature', index)"
                    />
                  </div>
                </div>
              </template>
            </draggable>

            <div
              v-else
              class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-800 rounded-lg text-center"
            >
              {{ $t('admin.products.form.no_features') }}
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="ph:plus"
              size="sm"
              class="w-full justify-center border-dashed"
              @click="emit('add-feature')"
            >
              {{ $t('admin.products.form.add_feature') }}
            </UButton>
          </template>

          <template v-else>
            <UTextarea
              v-model="featuresJsonModel"
              :rows="10"
              class="font-mono text-sm text-gray-900 dark:text-white w-full"
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
      <slot name="badge-field" />
      <slot name="color-field" />
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const props = defineProps<{
  visible: boolean
  locale: string
  isVisualMode: boolean
  featuresJson: string
  featuresList: any[]
}>()

const emit = defineEmits<{
  'toggle-mode': []
  'update:features-json': [value: string]
  'update:features-list': [value: any[]]
  'add-feature': []
  'remove-feature': [index: number]
}>()

const featuresJsonModel = computed({
  get: () => props.featuresJson,
  set: (value: string) => emit('update:features-json', value),
})

const featuresListModel = computed({
  get: () => props.featuresList,
  set: (value: any[]) => emit('update:features-list', value),
})
</script>
