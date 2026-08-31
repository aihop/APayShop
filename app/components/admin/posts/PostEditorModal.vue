<template>
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-6xl"
    :title="editingId ? $t('admin.posts.editor.editTitle') : $t('admin.posts.editor.createTitle')"
  >
    <div
      v-if="supportedLocales.length > 1"
      class="border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#121214] mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6"
    >
      <nav class="flex space-x-2 overflow-x-auto hide-scrollbar pb-2">
        <button
          v-for="locale in supportedLocales"
          :key="locale"
          type="button"
          @click="() => {
            if (locale !== defaultLocale && !form.title) return;
            currentTabLocale = locale;
          }"
          :class="[
            'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            currentTabLocale === locale
              ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
              : locale !== defaultLocale && !form.title
                ? 'text-gray-600 cursor-not-allowed border border-transparent'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'
          ]"
          :disabled="locale !== defaultLocale && !form.title"
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

    <UForm
      :state="form"
      class="space-y-6"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UFormField
          :label="currentTabLocale === defaultLocale
            ? $t('admin.posts.editor.fieldTitle')
            : $t('admin.posts.editor.fieldTitleLocale', { locale: currentTabLocale })"
          name="title"
          required
        >
          <UInput
            v-if="currentTabLocale === defaultLocale"
            v-model="form.title"
            class="w-full"
            @input="generateSlug"
          />
          <UInput
            v-else
            v-model="translationForms[currentTabLocale].title"
            class="w-full"
            :placeholder="$t('admin.posts.editor.translatedTitlePlaceholder', { locale: currentTabLocale })"
          />
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldSlug')"
          name="slug"
          required
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.slug"
            class="w-full font-mono text-sm"
          />
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldKey')"
          name="key"
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.key"
            class="w-full font-mono text-sm"
            :placeholder="$t('admin.posts.editor.keyPlaceholder')"
          />
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldSort')"
          name="sort"
          v-if="currentTabLocale === defaultLocale"
        >
          <UInput
            v-model="form.sort"
            type="number"
            class="w-full font-mono text-sm"
            :placeholder="$t('admin.posts.editor.sortPlaceholder')"
          />
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldType')"
          name="type"
          v-if="currentTabLocale === defaultLocale"
        >
          <USelectMenu
            v-model="form.type"
            :items="typeOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldCover')"
          name="imageUrl"
          v-if="currentTabLocale === defaultLocale"
        >
          <div class="flex gap-2 w-full">
            <UInput
              v-model="form.imageUrl"
              class="flex-1"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="ph:upload-simple"
              :loading="isUploading"
              @click="fileInput?.click()"
            >
              {{ $t('admin.posts.editor.upload') }}
            </UButton>
            <input
              type="file"
              ref="fileInput"
              class="hidden"
              accept="image/png, image/jpeg, image/webp, image/gif"
              @change="handleFileUpload"
            />
          </div>
        </UFormField>
      </div>

      <UFormField
        name="description"
      >
        <template #label>
          <div class="flex items-center justify-between w-full">
            <span>
              {{ currentTabLocale === defaultLocale
                ? $t('admin.posts.editor.fieldDescription')
                : $t('admin.posts.editor.fieldDescriptionLocale', { locale: currentTabLocale }) }}
            </span>
            <UButton
              v-if="currentTabLocale === defaultLocale"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="ph:text-align-left"
              :disabled="!form.content"
              @click="generateDescription"
              class="ml-2 shrink-0"
            >
              {{ $t('admin.posts.editor.generateDesc') }}
            </UButton>
          </div>
        </template>
        <UTextarea
          v-if="currentTabLocale === defaultLocale"
          v-model="form.description"
          :rows="2"
          class="w-full"
        />
        <UTextarea
          v-else
          v-model="translationForms[currentTabLocale].description"
          :rows="2"
          class="w-full"
          :placeholder="$t('admin.posts.editor.translatedDescPlaceholder', { locale: currentTabLocale })"
        />
      </UFormField>

      <UFormField
        :label="currentTabLocale === defaultLocale
          ? $t('admin.posts.editor.fieldContent')
          : $t('admin.posts.editor.fieldContentLocale', { locale: currentTabLocale })"
        name="content"
      >
        <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50">
          <RichEditor
            v-if="currentTabLocale === defaultLocale"
            v-model="form.content"
          />
          <RichEditor
            v-else
            v-model="translationForms[currentTabLocale].content"
          />
        </div>
      </UFormField>

      <UFormField
        name="isActive"
        v-if="currentTabLocale === defaultLocale"
      >
        <UCheckbox
          v-model="form.isActive"
          :label="$t('admin.posts.editor.publishNow')"
        />
      </UFormField>
    </UForm>
    <template #footer>
      <div class="flex justify-end gap-3 ">
        <UButton
          variant="ghost"
          @click="isOpen = false"
        >
          {{ $t('admin.common.cancel') }}
        </UButton>
        <UButton
          type="submit"
          color="primary"
          variant="solid"
          @click="onSubmit"
          :loading="isSaving"
          :disabled="!hasAdminPerm('posts:edit')"
        >
          {{ editingId ? $t('admin.common.save') : $t('admin.posts.editor.createTitle') }}
        </UButton>
      </div>
    </template>
  </FullScreenModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  post?: any | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()
const { settings } = useSettings()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const typeOptions = computed(() => [
  { label: t('admin.posts.type.blog'), value: 'blog' },
  { label: t('admin.posts.type.announcement'), value: 'announcement' },
  { label: t('admin.posts.type.page'), value: 'page' },
  { label: t('admin.posts.type.changelog'), value: 'changelog' },
])

const rawSupportedLocales = computed(() => {
  if (settings.value) {
    let i18nEnabled = 'true'
    let rawLocales = 'en,zh'

    if (Array.isArray(settings.value)) {
      const i18nSetting = settings.value.find((s: any) => s.key === 'i18n_enabled')
      if (i18nSetting) i18nEnabled = String(i18nSetting.value)
      const localesSetting = settings.value.find((s: any) => s.key === 'supported_locales')
      if (localesSetting) rawLocales = String(localesSetting.value)
    } else {
      if ((settings.value as any).i18n_enabled !== undefined) {
        i18nEnabled = String((settings.value as any).i18n_enabled)
      }
      if ((settings.value as any).supported_locales !== undefined) {
        rawLocales = String((settings.value as any).supported_locales)
      }
    }

    if (i18nEnabled === 'false') {
      return ['en']
    }

    if (rawLocales === '') {
      return ['en']
    }

    return rawLocales
      .split(',')
      .map((l: string) => l.trim())
      .filter(Boolean)
  }
  return ['en', 'zh']
})

const defaultLocale = computed(() => {
  if (settings.value) {
    if (Array.isArray(settings.value)) {
      const defaultLocaleSetting = settings.value.find((s: any) => s.key === 'default_locale')
      if (defaultLocaleSetting && defaultLocaleSetting.value) {
        return defaultLocaleSetting.value
      }
    } else if ((settings.value as any).default_locale) {
      return (settings.value as any).default_locale
    }
  }
  return rawSupportedLocales.value[0] || 'en'
})

const supportedLocales = computed(() => {
  const list = [...rawSupportedLocales.value]
  const def = defaultLocale.value
  if (!def || !list.includes(def)) return list
  return [def, ...list.filter((l) => l !== def)]
})
const currentTabLocale = ref(defaultLocale.value || 'en') as any

watch(
  defaultLocale,
  (val: string) => {
    if (!currentTabLocale.value || currentTabLocale.value === 'en') {
      currentTabLocale.value = val || 'en'
    }
  },
  { immediate: true },
)

const translationForms = reactive<Record<string, any>>({})

const isSaving = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingId = ref<number | null>(null)

const defaultForm = {
  title: '',
  key: '',
  sort: '',
  slug: '',
  description: '',
  content: '',
  type: 'blog',
  imageUrl: '',
  isActive: true,
  metaData: {} as any,
}

const form = ref({ ...defaultForm })

const generateSlug = () => {
  if (editingId.value) return // Don't auto-update slug when editing

  form.value.slug = form.value.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

const generateDescription = () => {
  const raw = (form.value.content || '')
    .replace(/<[^>]+>/g, ' ')   // strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return

  const MAX = 200
  const trimmed = raw.length <= MAX ? raw : raw.slice(0, MAX).replace(/\s+\S*$/, '') + '…'
  form.value.description = trimmed
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return

    for (const key in translationForms) {
      delete translationForms[key]
    }
    supportedLocales.value.forEach((l: string) => {
      if (l !== defaultLocale.value) {
        translationForms[l] = { title: '', description: '', content: '' }
      }
    })

    if (props.post) {
      editingId.value = props.post.id
      form.value = { ...props.post }
      if (!form.value.key) form.value.key = ''
      if (form.value.sort === null || form.value.sort === undefined) form.value.sort = ''
      if (!form.value.metaData) form.value.metaData = {}
      if (typeof form.value.metaData === 'string') {
        try {
          form.value.metaData = JSON.parse(form.value.metaData)
        } catch {
          form.value.metaData = {}
        }
      }

      if (form.value.metaData?.translations) {
        Object.keys(form.value.metaData.translations).forEach((loc) => {
          if (loc !== defaultLocale.value && translationForms[loc]) {
            const trans = form.value.metaData.translations[loc]
            translationForms[loc].title = trans.title || ''
            translationForms[loc].description = trans.description || ''
            translationForms[loc].content = trans.content || ''
          }
        })
      }
    } else {
      editingId.value = null
      form.value = { ...defaultForm }
    }

    currentTabLocale.value = defaultLocale.value
  },
)

const onSubmit = async () => {
  if (!form.value.title || !form.value.slug) {
    toast.add({ title: t('admin.common.error'), description: t('admin.posts.toast.titleRequired'), color: 'error' })
    return
  }

  if (!form.value.metaData) form.value.metaData = {}
  if (!form.value.metaData.translations) form.value.metaData.translations = {}

  for (const loc of supportedLocales.value) {
    if (loc === defaultLocale.value) continue

    const trans = translationForms[loc]
    if (!trans) continue

    if (!form.value.metaData.translations[loc]) {
      form.value.metaData.translations[loc] = {}
    }

    form.value.metaData.translations[loc].title = trans.title
    form.value.metaData.translations[loc].description = trans.description
    form.value.metaData.translations[loc].content = trans.content
  }

  isSaving.value = true
  try {
    const url = editingId.value ? `/api/admin/posts/${editingId.value}` : '/api/admin/posts'
    const method = editingId.value ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: {
        ...form.value,
        key: typeof form.value.key === 'string' && form.value.key.trim() ? form.value.key.trim() : null,
        sort:
          form.value.sort === '' || form.value.sort === null || form.value.sort === undefined
            ? null
            : Number.isFinite(Number(form.value.sort))
              ? Number(form.value.sort)
              : null,
      },
    })

    toast.add({
      title: t('admin.common.success'),
      description: editingId.value ? t('admin.posts.toast.saved') : t('admin.posts.toast.created'),
      color: 'success',
    })

    isOpen.value = false
    emit('saved')
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: e.data?.message || t('admin.posts.toast.saveFailed'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  isUploading.value = true
  try {
    const formData = new FormData()
    if (files[0]) {
      formData.append('files', files[0]) // Only taking the first file for cover image
    }

    const res: any = await $fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.urls && res.urls.length > 0) {
      form.value.imageUrl = res.urls[0]
    }
  } catch (error) {
    toast.add({ title: t('admin.common.error'), description: t('admin.posts.toast.uploadFailed'), color: 'error' })
    console.error(error)
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>
