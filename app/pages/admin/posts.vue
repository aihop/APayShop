<template>
  <div class="h-[calc(100vh-7rem)] flex flex-col space-y-4">
    <!-- Header & Action Row -->
    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {{ $t('admin.posts.title') }}
          </h1>
          <UBadge
            color="primary"
            variant="subtle"
            size="xs"
            class="font-mono font-medium"
          >
            {{ totalItems }}
          </UBadge>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
          {{ $t('admin.posts.subtitle') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrow-clockwise"
          size="sm"
          :loading="pending"
          class="rounded-xl"
          @click="refresh"
        />

        <UDropdownMenu
          v-if="hasAdminPerm('posts:edit')"
          :items="createMenuItems"
          :ui="{ content: 'w-48' }"
        >
          <UButton
            color="primary"
            size="sm"
            class="bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-xs font-medium"
            icon="ph:plus-bold"
            trailing-icon="ph:caret-down-bold"
          >
            {{ $t('admin.posts.createPost') }}
          </UButton>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Overview Metric Cards (Compact Inline Pills) -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
      <!-- Total Posts -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-all group"
        :class="{ 'ring-1 ring-purple-500 border-purple-500': selectedStatus === 'all' && !searchKeyword }"
        @click="selectedStatus = 'all'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:files-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.posts.stats.total') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-gray-900 dark:text-white font-mono ml-2 shrink-0">{{ stats.total }}</span>
      </div>

      <!-- Published Posts -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-all group"
        :class="{ 'ring-1 ring-emerald-500 border-emerald-500': selectedStatus === 'published' }"
        @click="selectedStatus = 'published'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:check-circle-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.posts.stats.published') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono ml-2 shrink-0">{{ stats.published }}</span>
      </div>

      <!-- Draft Posts -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-amber-500/50 hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-all group"
        :class="{ 'ring-1 ring-amber-500 border-amber-500': selectedStatus === 'draft' }"
        @click="selectedStatus = 'draft'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:pencil-circle-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.posts.stats.draft') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-amber-600 dark:text-amber-400 font-mono ml-2 shrink-0">{{ stats.draft }}</span>
      </div>

      <!-- Total Views -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:chart-bar-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.posts.stats.views') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-gray-900 dark:text-white font-mono ml-2 shrink-0">{{ formatNumber(stats.totalViews) }}</span>
      </div>
    </div>

    <!-- Main Table Card Container -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <!-- Search & Filters Toolbar -->
      <div class="p-4 border-b border-gray-200/70 dark:border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 dark:bg-[#18181b]/30">
        <div class="w-full sm:w-80">
          <UInput
            v-model="searchInput"
            icon="ph:magnifying-glass"
            :placeholder="$t('admin.posts.filter.searchPlaceholder')"
            size="md"
            class="w-full"
            :ui="{ base: 'rounded-xl' }"
            clearable
          />
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
          <!-- Type Filter -->
          <USelect
            v-model="selectedType"
            :items="typeOptions"
            size="md"
            class="w-36"
            :ui="{ base: 'rounded-xl' }"
          />

          <!-- Status Filter -->
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            size="md"
            class="w-32"
            :ui="{ base: 'rounded-xl' }"
          />

          <!-- Reset Filter Button (if filtered) -->
          <UButton
            v-if="searchKeyword || selectedType !== 'all' || selectedStatus !== 'all'"
            color="neutral"
            variant="subtle"
            size="md"
            icon="ph:x"
            class="rounded-xl"
            @click="resetFilters"
          >
            {{ $t('admin.posts.empty.clear') }}
          </UButton>
        </div>
      </div>

      <!-- Table Section -->
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedPosts"
          :columns="columns"
          :loading="pending"
          sticky
        >
          <!-- 封面图列 -->
          <template #image-cell="{ row }">
            <div class="w-16 h-11 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-center shrink-0 shadow-2xs group relative">
              <img
                v-if="row.original.imageUrl"
                :src="String(row.original.imageUrl)"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                :alt="String(row.original.title)"
              />
              <div
                v-else
                class="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center text-gray-400 dark:text-gray-500"
              >
                <UIcon name="ph:image-duotone" class="w-5 h-5" />
              </div>
            </div>
          </template>

          <!-- 标题与多维元信息列 -->
          <template #title-cell="{ row }">
            <div class="flex flex-col gap-1 py-1 max-w-md">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-white leading-snug hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer" @click="editPost(row.original)">
                  {{ row.original.title }}
                </span>
              </div>

              <!-- 简介摘要（如果存在） -->
              <p
                v-if="row.original.description"
                class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed"
              >
                {{ row.original.description }}
              </p>

              <!-- 元数据胶囊栏 -->
              <div class="flex items-center gap-2 flex-wrap pt-0.5">
                <span
                  class="inline-flex items-center gap-1 text-[11px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
                  @click.stop="copyPostUrl(row.original.slug)"
                  title="点击复制链接"
                >
                  <UIcon name="ph:link-simple" class="w-3 h-3 shrink-0" />
                  /blog/{{ row.original.slug }}
                </span>

                <span
                  v-if="row.original.key"
                  class="inline-flex items-center gap-1 text-[11px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded-md"
                >
                  key: {{ row.original.key }}
                </span>

                <span
                  v-if="row.original.sort !== null && row.original.sort !== undefined && row.original.sort !== 0"
                  class="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md"
                >
                  sort: {{ row.original.sort }}
                </span>
              </div>
            </div>
          </template>

          <!-- 语义化多彩类型列 -->
          <template #type-cell="{ row }">
            <UBadge
              :color="getTypeBadgeColor(row.original.type)"
              variant="subtle"
              size="sm"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium"
            >
              <UIcon :name="getTypeBadgeIcon(row.original.type)" class="w-3.5 h-3.5" />
              {{ typeLabel(String(row.original.type)) }}
            </UBadge>
          </template>

          <!-- 浏览量列 -->
          <template #views-cell="{ row }">
            <span class="text-gray-600 dark:text-gray-300 font-mono text-sm inline-flex items-center gap-1.5">
              <UIcon name="ph:eye-duotone" class="w-4 h-4 text-gray-400 dark:text-gray-500" />
              {{ formatNumber(row.original.views || 0) }}
            </span>
          </template>

          <!-- 状态切换列（快捷 Switch & Badge） -->
          <template #status-cell="{ row }">
            <div class="flex items-center gap-2">
              <USwitch
                :model-value="Boolean(row.original.isActive)"
                :disabled="!hasAdminPerm('posts:edit') || togglingId === row.original.id"
                size="sm"
                @update:model-value="(val) => togglePostStatus(row.original, val)"
              />
              <UBadge
                :color="row.original.isActive ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
                class="font-medium"
              >
                {{ row.original.isActive ? $t('admin.posts.status.published') : $t('admin.posts.status.draft') }}
              </UBadge>
            </div>
          </template>

          <!-- 时间列 -->
          <template #createdAt-cell="{ row }">
            <div class="flex flex-col text-xs">
              <span class="text-gray-700 dark:text-gray-300 font-medium">
                {{ formatDate(row.original.createdAt) }}
              </span>
              <span v-if="row.original.updatedAt && row.original.updatedAt !== row.original.createdAt" class="text-gray-400 dark:text-gray-500 text-[11px]">
                {{ formatDate(row.original.updatedAt) }}
              </span>
            </div>
          </template>

          <!-- 操作列 -->
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <!-- 前台预览 -->
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:arrow-square-out"
                size="sm"
                :title="$t('admin.posts.actions.preview')"
                :to="localePath(`/blog/${row.original.slug}`)"
                target="_blank"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              />
              <!-- 复制链接 -->
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:copy"
                size="sm"
                :title="$t('admin.posts.actions.copyLink')"
                @click="copyPostUrl(row.original.slug)"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              />
              <!-- 编辑 -->
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                size="sm"
                :title="$t('admin.posts.actions.edit')"
                @click="editPost(row.original)"
                :disabled="!hasAdminPerm('posts:edit')"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              />
              <!-- 删除 -->
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                :title="$t('admin.posts.actions.delete')"
                @click="deletePost(row.original.id)"
                :disabled="!hasAdminPerm('posts:edit')"
                class="rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
              />
            </div>
          </template>

          <!-- 空状态展示 -->
          <template #empty>
            <div class="py-12 flex flex-col items-center justify-center text-center">
              <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                <UIcon name="ph:article-duotone" class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ $t('admin.posts.empty.title') }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                {{ $t('admin.posts.empty.description') }}
              </p>
              <div class="mt-4 flex items-center gap-2">
                <UButton
                  v-if="searchKeyword || selectedType !== 'all' || selectedStatus !== 'all'"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  class="rounded-lg"
                  @click="resetFilters"
                >
                  {{ $t('admin.posts.empty.clear') }}
                </UButton>
                <UButton
                  v-if="hasAdminPerm('posts:edit')"
                  color="primary"
                  size="xs"
                  class="rounded-lg"
                  @click="openModal()"
                >
                  {{ $t('admin.posts.createPost') }}
                </UButton>
              </div>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200/70 dark:border-gray-800/60 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
          {{ $t('admin.posts.pagination.showing', {
            from: totalItems === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalItems),
            to: Math.min(page * pageSize, totalItems),
            total: totalItems,
          }) }}
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageSize"
          :max="5"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Modals -->
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
import { computed, ref, watch } from 'vue'
import { useLocaleRouter } from '~/composables/useLocaleRouter'

definePageMeta({ title: 'Posts Management', layout: 'admin' })

const { t } = useI18n()
const toast = useToast()
const { formatDate } = useFormatTime()
const { confirm } = useConfirm()
const { localePath } = useLocaleRouter()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

interface AdminPostRow {
  id: number
  title: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  sort?: number | null
  key?: string | null
  type: string
  views?: number
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

// 格式化数字千分位
const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num || 0)
}

// 复制前台文章 URL
const copyPostUrl = async (slug: string) => {
  try {
    const origin = window.location.origin
    const fullUrl = `${origin}/blog/${slug}`
    await navigator.clipboard.writeText(fullUrl)
    toast.add({
      title: t('admin.common.success'),
      description: t('admin.posts.toast.copiedUrl'),
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('admin.common.error'),
      description: '复制失败',
      color: 'error',
    })
  }
}

// 多彩语义化 Badge 颜色与图标
const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'changelog':
      return 'primary' // 紫色
    case 'announcement':
      return 'warning' // 琥珀色
    case 'page':
      return 'info' // 青蓝色
    case 'blog':
    default:
      return 'neutral' // 灰色/默认
  }
}

const getTypeBadgeIcon = (type: string) => {
  switch (type) {
    case 'changelog':
      return 'ph:rocket-launch'
    case 'announcement':
      return 'ph:megaphone'
    case 'page':
      return 'ph:file-text'
    case 'blog':
    default:
      return 'ph:article'
  }
}

const typeLabel = (type: string) =>
  t(`admin.posts.type.${type}`, t(`admin.posts.type.blog`))

const columns = computed(() => [
  { accessorKey: 'id', header: 'ID', meta: { class: { th: 'w-16 text-center font-mono', td: 'text-center font-mono text-xs text-gray-500' } } },
  { accessorKey: 'image', header: t('admin.posts.col.cover'), meta: { class: { th: 'w-20' } } },
  { accessorKey: 'title', header: t('admin.posts.col.title') },
  { accessorKey: 'type', header: t('admin.posts.col.type'), meta: { class: { th: 'w-32' } } },
  { accessorKey: 'views', header: t('admin.posts.col.views'), meta: { class: { th: 'w-28' } } },
  { accessorKey: 'status', header: t('admin.posts.col.status'), meta: { class: { th: 'w-36' } } },
  { accessorKey: 'createdAt', header: t('admin.posts.col.date'), meta: { class: { th: 'w-36' } } },
  {
    accessorKey: 'actions',
    header: t('admin.posts.col.actions'),
    meta: {
      class: {
        th: 'w-32 text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
      },
    },
  },
])

// Filters & Search
const searchInput = ref('')
const searchKeyword = ref('')
const selectedType = ref('all')
const selectedStatus = ref('all')

const typeOptions = computed(() => [
  { label: t('admin.posts.filter.allTypes'), value: 'all' },
  { label: t('admin.posts.type.blog'), value: 'blog' },
  { label: t('admin.posts.type.changelog'), value: 'changelog' },
  { label: t('admin.posts.type.announcement'), value: 'announcement' },
  { label: t('admin.posts.type.page'), value: 'page' },
])

const statusOptions = computed(() => [
  { label: t('admin.posts.filter.allStatus'), value: 'all' },
  { label: t('admin.posts.filter.statusPublished'), value: 'published' },
  { label: t('admin.posts.filter.statusDraft'), value: 'draft' },
])

let searchDebounceTimer: any = null
watch(searchInput, (val) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchKeyword.value = val.trim()
    page.value = 1
  }, 300)
})

watch([selectedType, selectedStatus], () => {
  page.value = 1
})

const resetFilters = () => {
  searchInput.value = ''
  searchKeyword.value = ''
  selectedType.value = 'all'
  selectedStatus.value = 'all'
  page.value = 1
}

// Pagination
const { page, pageSize, onPageChange } = usePagination(15)

// Fetch posts & stats
const {
  data: postsData,
  pending,
  refresh,
} = useFetch<any>('/api/admin/posts', {
  query: computed(() => ({
    page: page.value,
    pageSize: pageSize.value,
    type: selectedType.value === 'all' ? undefined : selectedType.value,
    status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
    search: searchKeyword.value || undefined,
  })),
  watch: [page, selectedType, selectedStatus, searchKeyword],
} as any)

const totalItems = computed(() => postsData.value?.total || 0)
const paginatedPosts = computed<AdminPostRow[]>(() => postsData.value?.data || [])
const stats = computed(() => postsData.value?.stats || { total: 0, published: 0, draft: 0, totalViews: 0 })

// ── Quick Toggle Status ──
const togglingId = ref<number | null>(null)
const togglePostStatus = async (post: AdminPostRow, newStatus: boolean) => {
  if (togglingId.value !== null) return
  togglingId.value = post.id
  try {
    await $fetch(`/api/admin/posts/${post.id}/status`, {
      method: 'PATCH',
      body: { isActive: newStatus },
    })
    post.isActive = newStatus
    toast.add({
      title: t('admin.common.success'),
      description: t('admin.posts.toast.statusUpdated'),
      color: 'success',
    })
    refresh()
  } catch (err: any) {
    toast.add({
      title: t('admin.common.error'),
      description: err.data?.message || '状态切换失败',
      color: 'error',
    })
  } finally {
    togglingId.value = null
  }
}

// ── Post editor modal ──
const isModalOpen = ref(false)
const editingPost = ref<any | null>(null)

const openModal = (post?: any) => {
  editingPost.value = post || null
  isModalOpen.value = true
}

// ── Changelog modal ──
const isChangelogModalOpen = ref(false)
const editingChangelogPost = ref<any | null>(null)

const openChangelogModal = (post?: any) => {
  editingChangelogPost.value = post || null
  isChangelogModalOpen.value = true
}

const createMenuItems = computed(() => [
  [
    {
      label: t('admin.posts.createMenu.article'),
      icon: 'ph:article',
      onSelect: () => openModal(),
    },
    {
      label: t('admin.posts.createMenu.changelog'),
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
    title: t('admin.posts.delete.title'),
    description: t('admin.posts.delete.description'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/posts/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('admin.common.success'),
      description: t('admin.posts.toast.deleted'),
      color: 'success',
    })
    refresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: e.data?.message || t('admin.posts.toast.deleteFailed'),
      color: 'error',
    })
  }
}
</script>
