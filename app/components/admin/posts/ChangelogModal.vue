<template>
  <!-- Separate & deliberately minimal on purpose: a changelog entry isn't a
       blog post — no cover image, no per-locale tabs, no manually-typed
       sort/version. Routing it through the generic post editor (with fields
       hidden/relabeled based on a `type` dropdown) was solving the wrong
       problem; this is its own flow. -->
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-2xl"
    :defaultFullscreen="false"
    :title="editingId ? '编辑更新记录' : '新建更新记录'"
  >
    <form
      id="changelog-form"
      @submit.prevent="save"
      class="space-y-5"
    >
      <UFormField
        label="版本号"
        name="version"
        required
      >
        <UInput
          v-model="form.version"
          class="w-full font-mono text-sm"
          placeholder="例如：v1.1.10"
          :loading="isFetchingLatestVersion"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">已根据上一个版本自动 +1，可以直接改。</p>
      </UFormField>

      <UFormField
        label="标题"
        name="title"
        required
      >
        <UInput
          v-model="form.title"
          class="w-full"
          @input="generateSlug"
        />
      </UFormField>

      <UFormField
        label="简介（可选）"
        name="description"
      >
        <UTextarea
          v-model="form.description"
          :rows="2"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="更新内容"
        name="content"
      >
        <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50">
          <RichEditor v-model="form.content" />
        </div>
      </UFormField>

      <UFormField name="isActive">
        <UCheckbox
          v-model="form.isActive"
          label="Publish immediately"
        />
      </UFormField>
    </form>

    <template #footer>
      <UButton
        variant="ghost"
        @click="isOpen = false"
      >
        Cancel
      </UButton>
      <UButton
        type="submit"
        form="changelog-form"
        color="primary"
        variant="solid"
        :loading="isSaving"
        :disabled="!hasAdminPerm('posts:edit')"
      >
        {{ editingId ? 'Save' : 'Create' }}
      </UButton>
    </template>
  </FullScreenModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  post?: any | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const editingId = ref<number | null>(null)
const isSaving = ref(false)
const isFetchingLatestVersion = ref(false)

const defaultForm = {
  version: '',
  title: '',
  description: '',
  content: '',
  isActive: true,
}
const form = ref({ ...defaultForm })

// Preserved from the edited post but not shown/editable here — carried
// through unchanged on save rather than overwritten with null.
const passthrough = ref<{ slug: string; sort: any; imageUrl: any; metaData: any }>({
  slug: '',
  sort: null,
  imageUrl: null,
  metaData: {},
})

const generateSlug = () => {
  if (editingId.value) return
  passthrough.value.slug = form.value.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

// "v1.1.9" -> "v1.1.10": keeps any non-numeric prefix, bumps the last
// dot-separated numeric segment by 1. Falls back to the input unchanged if
// it doesn't look like a version string — left for the admin to fix by hand
// rather than guessed.
const bumpVersion = (version: string): string => {
  const match = version.match(/^(\D*)(\d+(?:\.\d+)*)$/)
  if (!match || !match[2]) return version
  const prefix = match[1] || ''
  const segments = match[2].split('.')
  const lastIndex = segments.length - 1
  segments[lastIndex] = String(Number(segments[lastIndex]) + 1)
  return prefix + segments.join('.')
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    if (props.post) {
      editingId.value = props.post.id
      form.value = {
        version: props.post.key || '',
        title: props.post.title || '',
        description: props.post.description || '',
        content: props.post.content || '',
        isActive: !!props.post.isActive,
      }
      passthrough.value = {
        slug: props.post.slug,
        sort: props.post.sort ?? null,
        imageUrl: props.post.imageUrl ?? null,
        metaData: props.post.metaData || {},
      }
      return
    }

    editingId.value = null
    form.value = { ...defaultForm }
    passthrough.value = { slug: '', sort: null, imageUrl: null, metaData: {} }

    isFetchingLatestVersion.value = true
    try {
      const res: any = await $fetch('/api/admin/posts', {
        query: { type: 'changelog', page: 1, pageSize: 1 },
      })
      const latestKey = res?.data?.[0]?.key
      if (latestKey) {
        form.value.version = bumpVersion(String(latestKey))
        form.value.title = form.value.version
        generateSlug()
      }
    } catch {
      // Leave blank — admin fills it in manually.
    } finally {
      isFetchingLatestVersion.value = false
    }
  },
)

const save = async () => {
  if (!form.value.version || !form.value.title) {
    toast.add({ title: 'Error', description: '版本号和标题不能为空', color: 'error' })
    return
  }
  if (!passthrough.value.slug) generateSlug()

  isSaving.value = true
  try {
    const url = editingId.value ? `/api/admin/posts/${editingId.value}` : '/api/admin/posts'
    const method = editingId.value ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: {
        title: form.value.title,
        description: form.value.description,
        content: form.value.content,
        isActive: form.value.isActive,
        type: 'changelog',
        key: form.value.version.trim(),
        slug: passthrough.value.slug,
        sort: passthrough.value.sort,
        imageUrl: passthrough.value.imageUrl,
        metaData: passthrough.value.metaData,
      },
    })

    toast.add({
      title: 'Success',
      description: editingId.value ? '更新记录已保存' : '更新记录已创建',
      color: 'success',
    })

    isOpen.value = false
    emit('saved')
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || '保存失败',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>
