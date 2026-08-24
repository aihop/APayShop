<template>
  <div class="space-y-6 pb-8">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ text.title }}</h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ text.pageDescription }}</p>
      </div>
      <UButton icon="ph:plus" @click="openCreate">{{ text.create }}</UButton>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#121214] md:flex-row md:items-end">
      <UFormField :label="text.search" class="flex-1">
        <UInput v-model="keywordInput" icon="ph:magnifying-glass" :placeholder="text.searchPlaceholder" class="w-full" @keyup.enter="applyFilters" />
      </UFormField>
      <UFormField :label="text.status"><USelect v-model="statusInput" :items="statusOptions" value-key="value" class="w-40" /></UFormField>
      <UButton icon="ph:funnel" :loading="pending" @click="applyFilters">{{ text.filter }}</UButton>
      <UButton color="neutral" variant="outline" icon="ph:arrow-clockwise" :loading="pending" @click="refresh()">{{ text.refresh }}</UButton>
    </div>

    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#121214]">
      <div class="overflow-x-auto">
        <UTable :data="rows" :columns="columns" :loading="pending" class="min-w-[900px]">
          <template #name-cell="{ row }">
            <div class="flex min-w-48 items-center gap-3">
              <img v-if="row.original.imageUrl" :src="row.original.imageUrl" alt="" class="h-10 w-10 rounded-lg object-cover" />
              <div v-else class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/5">
                <UIcon name="ph:paint-brush-broad" class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-900 dark:text-white">{{ row.original.name }}</p>
                <p class="truncate text-xs text-gray-500">{{ row.original.uniqueName }}</p>
              </div>
            </div>
          </template>
          <template #category-cell="{ row }"><UBadge color="neutral" variant="subtle">{{ row.original.category || '—' }}</UBadge></template>
          <template #priceAmount-cell="{ row }"><span class="font-medium">{{ formatPrice(row.original.priceAmount) }}</span></template>
          <template #status-cell="{ row }">
            <UBadge :color="row.original.status === 20 ? 'success' : 'neutral'" variant="subtle">
              {{ row.original.status === 20 ? text.published : text.draft }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                v-if="row.original.demoUrl"
                :to="row.original.demoUrl"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="ph:arrow-square-out"
                :aria-label="text.demoUrl"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="row.original.status === 20 ? 'ph:eye-slash' : 'ph:upload-simple'"
                :loading="busyId === row.original.id"
                :aria-label="row.original.status === 20 ? text.unpublish : text.publish"
                @click="toggleStatus(row.original)"
              />
              <UButton color="neutral" variant="ghost" size="sm" icon="ph:pencil-simple" :aria-label="text.edit" @click="openEdit(row.original)" />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="ph:trash"
                :disabled="row.original.status === 20"
                :loading="busyId === row.original.id"
                :aria-label="text.delete"
                @click="removeItem(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
      <div class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-white/10">
        <span class="text-xs text-gray-500">{{ text.total.replace('{total}', String(total)) }}</span>
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
      </div>
    </div>

    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-4xl' }">
      <template #content>
        <form class="max-h-[90vh] overflow-y-auto" @submit.prevent="save">
          <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#121214]">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ form.id ? text.editTitle : text.createTitle }}</h2>
              <p class="text-xs text-gray-500">{{ text.formHint }}</p>
            </div>
            <UButton color="neutral" variant="ghost" icon="ph:x" :aria-label="text.close" @click="modalOpen = false" />
          </div>

          <div class="grid gap-5 p-6 md:grid-cols-2">
            <UFormField :label="text.name" required><UInput v-model="form.name" maxlength="160" class="w-full" /></UFormField>
            <UFormField :label="text.category"><UInput v-model="form.category" maxlength="120" class="w-full" /></UFormField>
            <UFormField :label="text.slug" required :description="text.slugHint"><UInput v-model="form.slug" maxlength="160" class="w-full" /></UFormField>
            <UFormField :label="text.uniqueName" required><UInput v-model="form.uniqueName" maxlength="190" class="w-full" /></UFormField>
            <UFormField :label="text.price" :description="text.priceHint" required>
              <UInput v-model.number="form.priceAmount" type="number" min="0" step="1" class="w-full" />
            </UFormField>
            <UFormField :label="text.status"><USelect v-model="form.status" :items="editableStatusOptions" value-key="value" class="w-full" /></UFormField>
            <UFormField :label="text.packageUrl"><UInput v-model="form.packageUrl" type="url" maxlength="2000" class="w-full" /></UFormField>
            <UFormField :label="text.demoUrl"><UInput v-model="form.demoUrl" type="url" maxlength="2000" class="w-full" /></UFormField>
            <UFormField :label="text.imageUrl" class="md:col-span-2"><UInput v-model="form.imageUrl" type="url" maxlength="2000" class="w-full" /></UFormField>
            <UFormField :label="text.subtitle" class="md:col-span-2"><UInput v-model="form.subtitle" maxlength="500" class="w-full" /></UFormField>
            <UFormField :label="text.content" class="md:col-span-2"><UTextarea v-model="form.content" :rows="7" maxlength="200000" class="w-full" /></UFormField>
            <UFormField :label="text.downloads"><UInput v-model.number="form.downs" type="number" min="0" step="1" class="w-full" /></UFormField>

            <div class="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-white/10 md:col-span-2">
              <h3 class="font-medium text-gray-900 dark:text-white">{{ text.settings }}</h3>
              <div class="grid gap-4 md:grid-cols-3">
                <UFormField label="siteURL"><UInput v-model="form.settings.siteURL" type="url" class="w-full" /></UFormField>
                <UFormField label="adminURL"><UInput v-model="form.settings.adminURL" type="url" class="w-full" /></UFormField>
                <UFormField label="gateway"><UInput v-model="form.settings.gateway" type="url" class="w-full" /></UFormField>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-white/10 md:col-span-2">
              <h3 class="font-medium text-gray-900 dark:text-white">SEO</h3>
              <UFormField :label="text.seoTitle"><UInput v-model="form.seo.title" maxlength="300" class="w-full" /></UFormField>
              <UFormField :label="text.seoKeywords"><UInput v-model="form.seo.keywords" maxlength="500" class="w-full" /></UFormField>
              <UFormField :label="text.seoDescription"><UTextarea v-model="form.seo.description" :rows="3" maxlength="1000" class="w-full" /></UFormField>
            </div>
          </div>

          <div class="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#121214]">
            <UButton color="neutral" variant="outline" @click="modalOpen = false">{{ text.cancel }}</UButton>
            <UButton type="submit" icon="ph:floppy-disk" :loading="saving">{{ text.save }}</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
type CatalogItem = {
  id: string
  name: string
  category: string
  slug: string
  imageUrl: string
  subtitle: string
  priceAmount: number
  content: string
  downs: number
  status: 10 | 20
  uniqueName: string
  packageUrl: string
  demoUrl: string
  settings: { siteURL: string, adminURL: string, gateway: string }
  seo: { title: string, keywords: string, description: string }
  createdAt: string
  updatedAt: string
}
const copyItem = (item?: CatalogItem) => ({
  id: item?.id || '', name: item?.name || '', category: item?.category || '', slug: item?.slug || '', imageUrl: item?.imageUrl || '',
  subtitle: item?.subtitle || '', priceAmount: item?.priceAmount || 0, content: item?.content || '', downs: item?.downs || 0,
  status: item?.status || 10 as 10 | 20, uniqueName: item?.uniqueName || '', packageUrl: item?.packageUrl || '', demoUrl: item?.demoUrl || '',
  settings: { siteURL: item?.settings.siteURL || '', adminURL: item?.settings.adminURL || '', gateway: item?.settings.gateway || '' },
  seo: { title: item?.seo.title || '', keywords: item?.seo.keywords || '', description: item?.seo.description || '' },
})
const { locale } = useI18n()
const toast = useToast()
const isZh = computed(() => locale.value.startsWith('zh'))
const dictionary = {
  en: {
    title: 'Themes', pageDescription: 'Manage storefront theme packages published in the marketplace.', create: 'New theme', search: 'Search',
    searchPlaceholder: 'Name, category, slug, or package name', status: 'Status', filter: 'Filter', refresh: 'Refresh', allStatuses: 'All statuses',
    draft: 'Draft', published: 'Published', total: '{total} themes', edit: 'Edit', delete: 'Delete', publish: 'Publish', unpublish: 'Move to draft',
    createTitle: 'Create theme', editTitle: 'Edit theme', formHint: 'This catalog is separate from APay active themes and never executes packages.',
    close: 'Close', name: 'Name', category: 'Category', slug: 'Slug', slugHint: 'Lowercase kebab-case', uniqueName: 'Unique package name',
    price: 'Price amount', priceHint: 'Smallest currency unit, for example cents', packageUrl: 'Package URL', demoUrl: 'Demo URL', imageUrl: 'Image URL',
    subtitle: 'Subtitle', content: 'Content', downloads: 'Historical downloads', settings: 'Integration URLs', seoTitle: 'SEO title',
    seoKeywords: 'SEO keywords', seoDescription: 'SEO description', cancel: 'Cancel', save: 'Save', saved: 'Theme saved', removed: 'Theme deleted',
    failed: 'Operation failed', confirmDelete: 'Delete this draft theme?',
  },
  zh: {
    title: '主题管理', pageDescription: '管理市场中发布的店铺主题包。', create: '新建主题', search: '搜索', searchPlaceholder: '名称、分类、slug 或包名',
    status: '状态', filter: '筛选', refresh: '刷新', allStatuses: '全部状态', draft: '草稿', published: '已上架', total: '共 {total} 个主题',
    edit: '编辑', delete: '删除', publish: '上架', unpublish: '下架为草稿', createTitle: '新建主题', editTitle: '编辑主题',
    formHint: '此目录与 APay 当前运行主题完全分离，也不会执行任何主题包。', close: '关闭', name: '名称', category: '分类', slug: 'Slug',
    slugHint: '仅小写字母、数字和连字符', uniqueName: '唯一包名', price: '价格整数', priceHint: '使用最小货币单位，例如分', packageUrl: '包地址',
    demoUrl: '演示地址', imageUrl: '图片地址', subtitle: '副标题', content: '详情内容', downloads: '历史下载数', settings: '集成地址',
    seoTitle: 'SEO 标题', seoKeywords: 'SEO 关键词', seoDescription: 'SEO 描述', cancel: '取消', save: '保存', saved: '主题已保存',
    removed: '主题已删除', failed: '操作失败', confirmDelete: '确定删除这个草稿主题吗？',
  },
}
const text = computed(() => isZh.value ? dictionary.zh : dictionary.en)
const columns = computed(() => [
  { accessorKey: 'name', header: text.value.name }, { accessorKey: 'category', header: text.value.category },
  { accessorKey: 'slug', header: 'Slug' }, { accessorKey: 'priceAmount', header: text.value.price },
  { accessorKey: 'downs', header: text.value.downloads }, { accessorKey: 'status', header: text.value.status },
  { accessorKey: 'actions', header: '' },
])
const statusOptions = computed(() => [
  { label: text.value.allStatuses, value: 0 }, { label: text.value.draft, value: 10 }, { label: text.value.published, value: 20 },
])
const editableStatusOptions = computed(() => statusOptions.value.slice(1))
const { page, pageSize } = usePagination(15)
const keywordInput = ref('')
const statusInput = ref(0)
const keyword = ref('')
const status = ref(0)
const modalOpen = ref(false)
const saving = ref(false)
const busyId = ref('')
const form = reactive(copyItem())
const { data, pending, refresh } = await useFetch<{ data: CatalogItem[], total: number }>('/api/admin/plugins/theme/catalog/list', {
  query: { page, pageSize, keyword, status }, watch: [page],
})
const rows = computed(() => data.value?.data || [])
const total = computed(() => data.value?.total || 0)
const apiError = (error: unknown) => {
  const candidate = error as { data?: { message?: string }, message?: string }
  return candidate.data?.message || candidate.message || text.value.failed
}
const formatPrice = (amount: number) => (amount / 100).toFixed(2)
const applyFilters = async () => {
  page.value = 1
  keyword.value = keywordInput.value.trim()
  status.value = statusInput.value
  await refresh()
}
const assignForm = (item?: CatalogItem) => Object.assign(form, copyItem(item))
const openCreate = () => { assignForm(); modalOpen.value = true }
const openEdit = (item: CatalogItem) => { assignForm(item); modalOpen.value = true }
const save = async () => {
  saving.value = true
  try {
    await $fetch(`/api/admin/plugins/theme/catalog/${form.id ? 'update' : 'create'}`, {
      method: form.id ? 'PATCH' : 'POST', body: { ...form },
    })
    modalOpen.value = false
    toast.add({ title: text.value.saved, color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: text.value.failed, description: apiError(error), color: 'error' })
  } finally {
    saving.value = false
  }
}
const toggleStatus = async (item: CatalogItem) => {
  busyId.value = item.id
  try {
    await $fetch('/api/admin/plugins/theme/catalog/update', { method: 'PATCH', body: { ...item, status: item.status === 20 ? 10 : 20 } })
    await refresh()
  } catch (error) {
    toast.add({ title: text.value.failed, description: apiError(error), color: 'error' })
  } finally {
    busyId.value = ''
  }
}
const removeItem = async (item: CatalogItem) => {
  if (item.status === 20 || !window.confirm(text.value.confirmDelete)) return
  busyId.value = item.id
  try {
    await $fetch('/api/admin/plugins/theme/catalog/delete', { method: 'DELETE', query: { id: item.id } })
    toast.add({ title: text.value.removed, color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({ title: text.value.failed, description: apiError(error), color: 'error' })
  } finally {
    busyId.value = ''
  }
}
</script>
