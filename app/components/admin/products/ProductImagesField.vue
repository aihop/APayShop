<template>
  <UFormField
    v-if="visible"
    :label="$t('admin.products.form.images')"
  >
    <div class="flex flex-col gap-4 w-full">
      <div class="flex gap-2 w-full">
        <UInput
          v-model="imageUrlInput"
          class="text-gray-900 dark:text-white flex-1"
          :placeholder="$t('admin.products.form.image_url_placeholder')"
          @keyup.enter.prevent="emit('add-url')"
        />
        <UButton
          color="primary"
          variant="outline"
          @click="emit('add-url')"
          :disabled="!imageUrlInput"
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
          @change="emit('upload', $event, fileInput)"
        />
      </div>

      <draggable
        v-if="images && images.length > 0"
        v-model="imagesModel"
        item-key="url"
        class="flex flex-wrap gap-4 mt-2"
        ghost-class="opacity-50"
        animation="200"
      >
        <template #item="{ element, index }">
          <div class="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 group cursor-move">
            <img
              :src="element"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-gray-900/50 dark:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <UButton
                color="primary"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                @click.stop="emit('preview', element)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                @click.stop="emit('remove', index)"
              />
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </UFormField>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const props = defineProps<{
  visible: boolean
  images: string[]
  newImageUrl: string
  isUploading: boolean
}>()

const emit = defineEmits<{
  'update:new-image-url': [value: string]
  'update:images': [value: string[]]
  'add-url': []
  upload: [event: Event, fileInput: HTMLInputElement | null]
  preview: [url: string]
  remove: [index: number]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const imageUrlInput = computed({
  get: () => props.newImageUrl,
  set: (value: string) => emit('update:new-image-url', value),
})

const imagesModel = computed({
  get: () => props.images,
  set: (value: string[]) => emit('update:images', value),
})
</script>
