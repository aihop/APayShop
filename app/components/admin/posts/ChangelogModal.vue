<template>
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-4xl"
    :defaultFullscreen="false"
    :title="modalTitle"
  >
    <!-- 多语言切换 Tab 导航 -->
    <div
      v-if="supportedLocales.length > 1"
      class="border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#121214] mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6"
    >
      <nav class="flex space-x-2 overflow-x-auto hide-scrollbar pb-2">
        <button
          v-for="locale in supportedLocales"
          :key="locale"
          type="button"
          @click="selectLocale(locale)"
          :class="getTabClass(locale)"
          :disabled="isTabDisabled(locale)"
        >
          <UIcon
            :name="locale === defaultLocale ? 'ph:star-fill' : 'ph:translate'"
            :class="locale === defaultLocale ? 'w-4 h-4 text-yellow-500' : 'w-4 h-4'"
          />
          {{ locale.toUpperCase() }}
        </button>
      </nav>
    </div>

    <UForm
      :state="form"
      class="space-y-5"
    >
      <!-- 版本号与 Slug (公共标识，仅在默认语言下编辑) -->
      <div v-if="currentTabLocale === defaultLocale" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField
          :label="$t('admin.posts.changelog.fieldVersion')"
          name="version"
          required
        >
          <UInput
            v-model="form.version"
            class="w-full font-mono text-sm"
            :placeholder="$t('admin.posts.changelog.versionPlaceholder')"
            :loading="isFetchingLatestVersion"
            @input="onVersionInput"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.posts.changelog.versionHint') }}</p>
        </UFormField>

        <UFormField
          :label="$t('admin.posts.editor.fieldSlug')"
          name="slug"
          required
        >
          <UInput
            v-model="form.slug"
            class="w-full font-mono text-sm"
            placeholder="v1.1.10"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">/changelog 访问与定位标识</p>
        </UFormField>
      </div>

      <!-- 更新标题 -->
      <UFormField
        :label="fieldTitleLabel"
        name="title"
        required
      >
        <UInput
          v-if="currentTabLocale === defaultLocale"
          v-model="form.title"
          class="w-full"
          @input="onTitleInput"
        />
        <UInput
          v-else
          v-model="translationForms[currentTabLocale].title"
          class="w-full"
          :placeholder="translatedTitlePlaceholder"
        />
      </UFormField>

      <!-- 更新摘要描述 -->
      <UFormField
        :label="$t('admin.posts.changelog.fieldDesc')"
        name="description"
      >
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
          :placeholder="translatedDescPlaceholder"
        />
      </UFormField>

      <!-- 更新内容富文本 -->
      <UFormField
        :label="$t('admin.posts.changelog.fieldContent')"
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

      <!-- 发布开关 (仅默认语言下展示) -->
      <UFormField v-if="currentTabLocale === defaultLocale" name="isActive">
        <UCheckbox
          v-model="form.isActive"
          :label="$t('admin.posts.changelog.publishNow')"
        />
      </UFormField>
    </UForm>

    <template #footer>
      <UButton
        variant="ghost"
        @click="isOpen = false"
      >
        {{ $t('admin.common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        variant="solid"
        :loading="isSaving"
        :disabled="!hasAdminPerm('posts:edit')"
        @click="save"
      >
        {{ saveButtonText }}
      </UButton>
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

const editingId = ref<number | null>(null)
const isSaving = ref(false)
const isFetchingLatestVersion = ref(false)

const modalTitle = computed(() => {
  return editingId.value ? t('admin.posts.changelog.editTitle') : t('admin.posts.changelog.createTitle')
})

const saveButtonText = computed(() => {
  return editingId.value ? t('admin.common.save') : t('admin.posts.changelog.createTitle')
})

// 多语言支持
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
  return ['en', 'zh', 'ru']
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

const fieldTitleLabel = computed(() => {
  if (currentTabLocale.value === defaultLocale.value) {
    return t('admin.posts.changelog.fieldTitle')
  }
  return t('admin.posts.editor.fieldTitleLocale', { locale: currentTabLocale.value })
})

const translatedTitlePlaceholder = computed(() => {
  return t('admin.posts.editor.translatedTitlePlaceholder', { locale: currentTabLocale.value })
})

const translatedDescPlaceholder = computed(() => {
  return t('admin.posts.editor.translatedDescPlaceholder', { locale: currentTabLocale.value })
})

function isTabDisabled(locale: string) {
  return locale !== defaultLocale.value && !form.value.title
}

function getTabClass(locale: string) {
  const base = 'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2'
  if (currentTabLocale.value === locale) {
    return `${base} bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold`
  }
  if (isTabDisabled(locale)) {
    return `${base} text-gray-400 cursor-not-allowed border border-transparent`
  }
  return `${base} text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent`
}

function selectLocale(locale: string) {
  if (isTabDisabled(locale)) return
  currentTabLocale.value = locale
}

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

const defaultForm = {
  version: '',
  slug: '',
  title: '',
  description: '',
  content: '',
  isActive: true,
}
const form = ref({ ...defaultForm })

// Preserved from the edited post but not shown/editable here
const passthrough = ref<{ sort: any; imageUrl: any; metaData: any }>({
  sort: null,
  imageUrl: null,
  metaData: {},
})

const generateSlug = () => {
  if (editingId.value) return
  const baseText = form.value.version || form.value.title
  form.value.slug = baseText
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

const onVersionInput = () => {
  if (!editingId.value) {
    generateSlug()
  }
}

const onTitleInput = () => {
  if (!editingId.value && !form.value.slug) {
    generateSlug()
  }
}

// "v1.1.9" -> "v1.1.10"
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

    // 1. 初始化多语言表单对象
    for (const key in translationForms) {
      delete translationForms[key]
    }
    supportedLocales.value.forEach((l: string) => {
      if (l !== defaultLocale.value) {
        translationForms[l] = { title: '', description: '', content: '' }
      }
    })

    // 2. 编辑模式回填
    if (props.post) {
      editingId.value = props.post.id
      form.value = {
        version: props.post.key || '',
        slug: props.post.slug || props.post.key || '',
        title: props.post.title || '',
        description: props.post.description || '',
        content: props.post.content || '',
        isActive: !!props.post.isActive,
      }

      let meta = props.post.metaData || {}
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta)
        } catch {
          meta = {}
        }
      }

      passthrough.value = {
        sort: props.post.sort ?? null,
        imageUrl: props.post.imageUrl ?? null,
        metaData: meta,
      }

      // 回填多语言翻译
      if (meta?.translations) {
        Object.keys(meta.translations).forEach((loc) => {
          if (loc !== defaultLocale.value && translationForms[loc]) {
            const trans = meta.translations[loc]
            translationForms[loc].title = trans.title || ''
            translationForms[loc].description = trans.description || ''
            translationForms[loc].content = trans.content || ''
          }
        })
      }

      currentTabLocale.value = defaultLocale.value
      return
    }

    // 3. 新建模式
    editingId.value = null
    form.value = { ...defaultForm }
    passthrough.value = { sort: null, imageUrl: null, metaData: {} }
    currentTabLocale.value = defaultLocale.value

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
      // Leave blank
    } finally {
      isFetchingLatestVersion.value = false
    }
  },
)

const save = async () => {
  if (!form.value.version || !form.value.title) {
    toast.add({ title: t('admin.common.error'), description: t('admin.posts.toast.changelogRequired'), color: 'error' })
    return
  }
  if (!form.value.slug) generateSlug()

  // 组装多语言翻译数据到 metaData.translations
  if (!passthrough.value.metaData) passthrough.value.metaData = {}
  if (!passthrough.value.metaData.translations) passthrough.value.metaData.translations = {}

  for (const loc of supportedLocales.value) {
    if (loc === defaultLocale.value) continue
    const trans = translationForms[loc]
    if (!trans) continue

    if (!passthrough.value.metaData.translations[loc]) {
      passthrough.value.metaData.translations[loc] = {}
    }

    passthrough.value.metaData.translations[loc].title = trans.title || ''
    passthrough.value.metaData.translations[loc].description = trans.description || ''
    passthrough.value.metaData.translations[loc].content = trans.content || ''
  }

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
        slug: form.value.slug.trim(),
        sort: passthrough.value.sort,
        imageUrl: passthrough.value.imageUrl,
        metaData: passthrough.value.metaData,
      },
    })

    toast.add({
      title: t('admin.common.success'),
      description: editingId.value ? t('admin.posts.toast.changelogSaved') : t('admin.posts.toast.changelogCreated'),
      color: 'success',
    })

    isOpen.value = false
    emit('saved')
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: e.data?.message || t('admin.posts.toast.changelogSaveFailed'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>
