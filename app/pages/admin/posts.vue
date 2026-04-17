<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.posts.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.posts.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.posts.createPost') }}</UButton>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedPosts"
          :columns="columns"
          :loading="pending"
          sticky
        >
          <template #image-cell="{ row }">
            <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
              <img
                v-if="row.original.imageUrl"
                :src="String(row.original.imageUrl)"
                class="w-full h-full object-cover"
                :alt="String(row.original.title)"
              />
              <UIcon
                v-else
                name="ph:image"
                class="w-5 h-5 text-gray-600"
              />
            </div>
          </template>

          <template #title-cell="{ row }">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-white">{{ row.original.title }}</span>
              <span class="text-xs text-gray-500 font-mono">/blog/{{ row.original.slug }}</span>
            </div>
          </template>

          <template #type-cell="{ row }">
            <UBadge
              color="gray"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ row.original.type }}
            </UBadge>
          </template>

          <template #views-cell="{ row }">
            <span class="text-gray-400 text-sm flex items-center gap-1">
              <UIcon
                name="ph:eye"
                class="w-4 h-4"
              />
              {{ row.original.views || 0 }}
            </span>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.isActive ? 'success' : 'gray'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.isActive ? 'Published' : 'Draft' }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-gray-400 text-sm">
              {{ new Date(row.original.createdAt).toLocaleDateString() }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="gray"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                :to="localePath(`/blog/${row.original.slug}`)"
                target="_blank"
              />
              <UButton
                color="gray"
                variant="ghost"
                icon="ph:pencil-simple"
                size="sm"
                @click="openModal(row.original)"
              />
              <UButton
                color="red"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                @click="deletePost(row.original.id)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-800/50 flex items-center justify-between shrink-0 bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-400">
          Showing {{ Math.min((page - 1) * pageSize + 1, totalItems) }} to
          {{ Math.min(page * pageSize, totalItems) }} of {{ totalItems }} entries
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :page-count="pageSize"
          :max="5"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Post Modal -->
    <FullScreenModal
      v-model="isModalOpen"
      maxWidth="sm:max-w-6xl"
      :title="editingId ? 'Edit Post' : 'Create Post'"
    >
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
              if (locale !== defaultLocale && !form.title) return;
              currentTabLocale = locale;
            }"
            :class="[
              'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              currentTabLocale === locale
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : locale !== defaultLocale && !form.title
                  ? 'text-gray-600 cursor-not-allowed border border-transparent'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
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
            :label="`Title` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')"
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
              :placeholder="`Translated title in ${currentTabLocale}`"
            />
          </UFormField>

          <UFormField
            label="Slug (URL)"
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
            label="Type"
            name="type"
            v-if="currentTabLocale === defaultLocale"
          >
            <USelectMenu
              v-model="form.type"
              :items="['blog', 'announcement', 'page', 'changelog']"
              class="w-full capitalize"
            />
          </UFormField>

          <UFormField
            label="Cover Image URL"
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
                Upload
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
          :label="`Description` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')"
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
            :placeholder="`Translated description in ${currentTabLocale}`"
          />
        </UFormField>

        <UFormField
          :label="`Content` + (currentTabLocale !== defaultLocale ? ` (${currentTabLocale})` : '')"
          name="content"
        >
          <div class="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
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
            label="Publish immediately"
          />
        </UFormField>
      </UForm>
      <template #footer>
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-800 mt-8">
          <UButton
            color="gray"
            variant="ghost"
            @click="isModalOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            @click="onSubmit"
            :loading="isSaving"
          >
            {{ editingId ? 'Save' : 'Create' }}
          </UButton>
        </div>
      </template>
    </FullScreenModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

definePageMeta({ title: 'Posts Management' })

const toast = useToast()
const { settings } = useSettings()
const { localePath } = useLocaleRouter()

// Language and Tabs Configuration
const supportedLocales = computed(() => {
  if (settings.value && Array.isArray(settings.value)) {
    const i18nEnabledSetting = settings.value.find(
      (s: any) => s.key === 'i18n_enabled'
    )
    const i18nEnabled = i18nEnabledSetting ? i18nEnabledSetting.value : 'true'

    if (i18nEnabled === 'false' || i18nEnabled === false) {
      return ['en']
    }

    const localesSetting = settings.value.find(
      (s: any) => s.key === 'supported_locales'
    )
    const rawLocales = localesSetting ? localesSetting.value : 'en,zh'

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
  if (settings.value && Array.isArray(settings.value)) {
    const defaultLocaleSetting = settings.value.find(
      (s: any) => s.key === 'default_locale'
    )
    if (defaultLocaleSetting && defaultLocaleSetting.value) {
      return defaultLocaleSetting.value
    }
  }
  return supportedLocales.value[0] || 'en'
})
const currentTabLocale = ref(defaultLocale.value || 'en') as any

watch(
  defaultLocale,
  (val) => {
    if (!currentTabLocale.value || currentTabLocale.value === 'en') {
      currentTabLocale.value = val || 'en'
    }
  },
  { immediate: true }
)

const translationForms = reactive<Record<string, any>>({})

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'image', header: 'Cover' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'views', header: 'Views' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Date' },
  {
    accessorKey: 'actions',
    header: 'Actions',
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
      },
    },
  },
]

// Pagination
const { page, pageSize, onPageChange } = usePagination(15)

// Fetch posts
const {
  data: postsData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/posts', {
  query: {
    page,
    pageSize: pageSize,
  },
  watch: [page],
})

const totalItems = computed(() => postsData.value?.total || 0)
const paginatedPosts = computed(() => postsData.value?.data || [])

// Modal & Form State
const isModalOpen = ref(false)
const isSaving = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingId = ref<number | null>(null)

const defaultForm = {
  title: '',
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

const openModal = (post?: any) => {
  // Clear translation forms first
  for (const key in translationForms) {
    delete translationForms[key]
  }

  supportedLocales.value.forEach((l: string) => {
    if (l !== defaultLocale.value) {
      translationForms[l] = {
        title: '',
        description: '',
        content: '',
      }
    }
  })

  if (post) {
    editingId.value = post.id
    form.value = { ...post }
    if (!form.value.metaData) form.value.metaData = {}
    if (typeof form.value.metaData === 'string') {
      try {
        form.value.metaData = JSON.parse(form.value.metaData)
      } catch (e) {
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
  isModalOpen.value = true
}

const onSubmit = async () => {
  if (!form.value.title || !form.value.slug) {
    toast.add({
      title: 'Error',
      description: 'Title and Slug are required',
      color: 'error',
    })
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
    const url = editingId.value
      ? `/api/admin/posts/${editingId.value}`
      : '/api/admin/posts'

    const method = editingId.value ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: form.value,
    })

    toast.add({
      title: 'Success',
      description: editingId.value
        ? 'Post updated successfully'
        : 'Post created successfully',
      color: 'success',
    })

    isModalOpen.value = false
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to save post',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const deletePost = async (id: number) => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete Post',
    description: 'Are you sure you want to delete this post?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/posts/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Success',
      description: 'Post deleted successfully',
      color: 'success',
    })
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete post',
      color: 'error',
    })
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
    toast.add({
      title: 'Error',
      description: 'Failed to upload image',
      color: 'error',
    })
    console.error(error)
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>