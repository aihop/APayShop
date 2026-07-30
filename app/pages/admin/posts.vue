<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.posts.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.posts.subtitle') }}</p>
      </div>
      <UDropdownMenu
        v-if="hasAdminPerm('posts:edit')"
        :items="createMenuItems"
        :ui="{ content: 'w-48' }"
      >
        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white"
          icon="ph:plus-bold"
          trailing-icon="ph:caret-down-bold"
        >{{ $t('admin.posts.createPost') }}</UButton>
      </UDropdownMenu>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedPosts"
          :columns="columns"
          :loading="pending"
          sticky
        >
          <template #image-cell="{ row }">
            <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
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
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ row.original.title }}</span>
              <span class="text-xs text-gray-500 font-mono">/blog/{{ row.original.slug }}</span>
              <span
                v-if="row.original.sort !== null && row.original.sort !== undefined"
                class="text-xs text-gray-500 font-mono"
              >sort: {{ row.original.sort }}</span>
              <span
                v-if="row.original.key"
                class="text-xs text-gray-500 font-mono"
              >key: {{ row.original.key }}</span>
            </div>
          </template>

          <template #type-cell="{ row }">
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ typeLabels[String(row.original.type)] || row.original.type }}
            </UBadge>
          </template>

          <template #views-cell="{ row }">
            <span class="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
              <UIcon
                name="ph:eye"
                class="w-4 h-4"
              />
              {{ row.original.views || 0 }}
            </span>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.isActive ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.isActive ? 'Published' : 'Draft' }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-gray-500 dark:text-gray-400 text-sm">
              {{ formatDate(row.original.createdAt) }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                :to="localePath(`/blog/${row.original.slug}`)"
                target="_blank"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                size="sm"
                @click="editPost(row.original)"
                :disabled="!hasAdminPerm('posts:edit')"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                @click="deletePost(row.original.id)"
                :disabled="!hasAdminPerm('posts:edit')"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-500 dark:text-gray-400">
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

    <AdminPostsPostEditorModal
      v-model="isModalOpen"
      :post="editingPost"
      @saved="refresh"
    />

    <AdminPostsChangelogModal
      v-model="isChangelogModalOpen"
      :post="editingChangelogPost"
      @saved="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { useLocaleRouter } from '~/composables/useLocaleRouter'

definePageMeta({ title: 'Posts Management', layout: 'admin' })

const toast = useToast()
const { formatDate } = useFormatTime()
const { confirm } = useConfirm()
const { localePath } = useLocaleRouter()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

interface AdminPostRow {
  id: number
  title: string
  slug: string
  imageUrl?: string | null
  sort?: number | null
  key?: string | null
  type: string
  views?: number
  isActive: boolean
  createdAt: string
}

const typeLabels: Record<string, string> = {
  blog: '默认文章',
  announcement: '公告',
  page: '页面',
  changelog: '更新记录',
}

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
        th: 'text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
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
} = useFetch<any>('/api/admin/posts', {
  query: {
    page,
    pageSize: pageSize,
  },
  watch: [page],
} as any)

const totalItems = computed(() => postsData.value?.total || 0)
const paginatedPosts = computed<AdminPostRow[]>(() => postsData.value?.data || [])

// ── Post editor modal (default article + everything else) ──
const isModalOpen = ref(false)
const editingPost = ref<any | null>(null)

const openModal = (post?: any) => {
  editingPost.value = post || null
  isModalOpen.value = true
}

// ── Changelog modal (separate, purpose-built — see component comment) ──
const isChangelogModalOpen = ref(false)
const editingChangelogPost = ref<any | null>(null)

const openChangelogModal = (post?: any) => {
  editingChangelogPost.value = post || null
  isChangelogModalOpen.value = true
}

const createMenuItems = computed(() => [
  [
    {
      label: '默认文章',
      icon: 'ph:article',
      onSelect: () => openModal(),
    },
    {
      label: '更新记录',
      icon: 'ph:rocket-launch',
      onSelect: () => openChangelogModal(),
    },
  ],
])

const editPost = (post: any) => {
  if (post.type === 'changelog') openChangelogModal(post)
  else openModal(post)
}

const deletePost = async (id: number) => {
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
</script>
