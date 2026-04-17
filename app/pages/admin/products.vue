<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">

    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.products.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.products.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.products.add') }}</UButton>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedProducts"
          :columns="columns"
          :loading="pending"
          :ui="{ tbody: 'my-table-tbody divide-y divide-gray-800' }"
          sticky
        >
          <template #drag-cell>
            <div class="w-10 flex items-center justify-center cursor-move text-gray-500 hover:text-white transition-colors">
              <UIcon
                name="ph:dots-six-vertical"
                class="w-5 h-5"
              />
            </div>
          </template>
          <template #image-cell="{ row }">
            <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
              <img
                v-if="row.original.imageUrl"
                :src="String(row.original.imageUrl)"
                class="w-full h-full object-cover"
                :alt="String(row.original.name)"
              />
              <UIcon
                v-else
                name="ph:image"
                class="w-6 h-6 text-gray-600"
              />
            </div>
          </template>
          <template #price-cell="{ row }">
            ${{ Number(row.original.price || 0).toFixed(2) }}
          </template>
          <template #type-cell="{ row }">
            <div class="flex items-center gap-2">
              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
                class="capitalize"
              >
                {{ row.original.type }}
              </UBadge>
              <UTooltip
                text="Shown as Pricing Plan on Frontend"
                v-if="row.original.metaData?.is_pricing_plan"
              >
                <UIcon
                  name="ph:star-fill"
                  class="w-4 h-4 text-yellow-500"
                />
              </UTooltip>
            </div>
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
          <template #isActive-cell="{ row }">
            <UBadge
              :color="row.original.isActive ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ row.original.isActive ? $t('admin.products.active') : $t('admin.products.inactive') }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="primary"
                variant="ghost"
                icon="ph:link"
                title="View Product Page"
                :to="`/products/${row.original.slug || row.original.id}`"
                target="_blank"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                @click="openModal(row.original)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                @click="deleteProduct(Number(row.original.id))"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-800/50 flex justify-between items-center shrink-0 bg-[#121214]">
        <div class="text-sm text-gray-400">
          <span class="text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :total="totalItems"
          :page-count="pageCount"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Product Modal -->
    <AdminProductFormModal
      v-model="isModalOpen"
      :product="editingProduct"
      @saved="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumn } from '@nuxt/ui'
import { useSortable } from '@vueuse/integrations/useSortable'

const { t } = useI18n()

definePageMeta({ title: 'Products Management' })

const toast = useToast()

const columns = computed(() => [
  { accessorKey: 'drag', header: '' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'image', header: 'Image' },
  { accessorKey: 'name', header: t('admin.products.name') },
  { accessorKey: 'price', header: t('admin.products.price') },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'views', header: 'Views' },
  { accessorKey: 'isActive', header: t('admin.products.status') },
  {
    accessorKey: 'actions',
    header: t('admin.products.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#121214]',
      },
    },
  },
])

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: productsData,
  pending,
  refresh,
  error,
} = await useFetch<any>('/api/admin/products', {
  query: {
    page,
    pageSize: pageCount,
  },
  watch: [page],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const paginatedProducts = computed(() => productsData.value?.data || [])
const totalItems = computed(() => productsData.value?.total || 0)

const isModalOpen = ref(false)
const editingProduct = ref<any>(null)

// 拖拽排序逻辑
useSortable('.my-table-tbody', paginatedProducts, {
  animation: 150,
  handle: '.cursor-move',
  onEnd: async (evt) => {
    const total = totalItems.value
    const startIndex = (page.value - 1) * pageCount.value

    // 生成基于新顺序的排序数据
    const reorderedItems = paginatedProducts.value.map((item, index) => ({
      id: item.id,
      sortOrder: total - (startIndex + index),
    }))

    try {
      await $fetch('/api/admin/products/reorder', {
        method: 'PUT',
        body: { items: reorderedItems },
      })
      toast.add({
        title: 'Success',
        description: 'Products reordered successfully',
        color: 'success',
      })
      await refresh()
    } catch (e: any) {
      toast.add({
        title: 'Error',
        description: 'Failed to reorder products',
        color: 'error',
      })
      await refresh()
    }
  },
})

const openModal = (product?: any) => {
  if (product && typeof product === 'object') {
    editingProduct.value = JSON.parse(JSON.stringify(product))
  } else {
    editingProduct.value = undefined
  }
  isModalOpen.value = true
}

const deleteProduct = async (id: number) => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete Product',
    description: 'Are you sure you want to delete this product?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: 'Success',
      description: 'Product deleted successfully',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete product',
      color: 'error',
    })
  }
}
</script>