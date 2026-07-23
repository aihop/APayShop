<template>
  <div
    v-if="visible"
    class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-[#1a1a1c]"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-gray-900 dark:text-white font-medium flex items-center gap-2">
        <UIcon
          name="ph:list-dashes"
          class="text-blue-400"
        />
        {{ $t('admin.products.form.service_settings') }}{{ localeSuffix }}
      </h3>
      <UButton
        v-if="isDefaultLocale"
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="isVisualMode ? 'ph:code' : 'ph:eye'"
        @click="emit('toggle-mode')"
      >
        {{ isVisualMode ? $t('admin.products.form.edit_raw_json') : $t('admin.products.form.visual_builder') }}
      </UButton>
    </div>

    <div
      v-if="isDefaultLocale"
      class="grid grid-cols-1 gap-4"
    >
      <UFormField :label="$t('admin.products.form.form_schema')">
        <div class="w-full space-y-3">
          <template v-if="isVisualMode">
            <draggable
              v-if="schemaList.length > 0"
              v-model="schemaListModel"
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

                  <div class="w-40">
                    <UInput
                      v-model="element.name"
                      :placeholder="$t('admin.products.form.field_name_placeholder')"
                      class="text-gray-900 dark:text-white"
                    />
                  </div>

                  <UInput
                    v-model="element.label"
                    :placeholder="$t('admin.products.form.field_label_placeholder')"
                    class="text-gray-900 dark:text-white flex-1"
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
                      @click="emit('remove-field', index)"
                    />
                  </div>
                </div>
              </template>
            </draggable>

            <div
              v-else
              class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-800 rounded-lg text-center"
            >
              {{ $t('admin.products.form.no_fields') }}
            </div>

            <UButton
              color="neutral"
              variant="outline"
              icon="ph:plus"
              size="sm"
              class="w-full justify-center border-dashed"
              @click="emit('add-field')"
            >
              {{ $t('admin.products.form.add_field') }}
            </UButton>
          </template>

          <template v-else>
            <UTextarea
              v-model="schemaJsonModel"
              :rows="10"
              class="font-mono text-sm text-gray-900 dark:text-white w-full"
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
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const props = defineProps<{
  visible: boolean
  isDefaultLocale: boolean
  localeSuffix: string
  isVisualMode: boolean
  schemaJson: string
  schemaList: any[]
  schemaFieldTypeOptions: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{
  'toggle-mode': []
  'update:schema-json': [value: string]
  'update:schema-list': [value: any[]]
  'add-field': []
  'remove-field': [index: number]
}>()

const schemaJsonModel = computed({
  get: () => props.schemaJson,
  set: (value: string) => emit('update:schema-json', value),
})

const schemaListModel = computed({
  get: () => props.schemaList,
  set: (value: any[]) => emit('update:schema-list', value),
})
</script>
