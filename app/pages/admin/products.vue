<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">

    <div class="flex justify-between items-end mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.products.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.products.subtitle') }}</p>
      </div>
      <UButton
        v-if="hasAdminPerm('products:edit')"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.products.add') }}</UButton>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedProducts"
          :columns="columns"
          :loading="pending"
          :ui="{ tbody: 'my-table-tbody divide-y divide-gray-200 dark:divide-gray-800' }"
          sticky
        >
          <template #drag-cell>
            <div class="w-10 flex items-center justify-center cursor-move text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
              <UIcon
                name="ph:dots-six-vertical"
                class="w-5 h-5"
              />
            </div>
          </template>
          <template #image-cell="{ row }">
            <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
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
            {{ formatCurrencyAmount(row.original.price, baseCurrency) }}
          </template>
          <template #type-cell="{ row }">
            <div class="flex flex-col gap-2 min-w-[16rem] py-1">
              <div class="flex items-center gap-2 flex-wrap">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="capitalize"
                >
                  {{ row.original.type }}
                </UBadge>
                <UTooltip
                  :text="$t('admin.products.pricingPlan')"
                  v-if="getProductMetaData(row.original).is_pricing_plan"
                >
                  <UIcon
                    name="ph:star-fill"
                    class="w-4 h-4 text-yellow-500"
                  />
                </UTooltip>
              </div>

              <div
                v-if="isPlanFeatureProduct(row.original) && getProductPlanFeatures(row.original).length"
                class="flex flex-wrap gap-1.5"
              >
                <UBadge
                  v-for="(feature, index) in getVisiblePlanFeatures(row.original)"
                  :key="`${row.original.id}-feature-${index}`"
                  :color="feature.included ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="sm"
                  class="max-w-full"
                >
                  <span
                    class="inline-flex items-center gap-1 max-w-full"
                    :class="feature.included ? '' : 'opacity-70'"
                  >
                    <UIcon
                      :name="feature.included ? 'ph:check' : 'ph:x'"
                      class="w-3.5 h-3.5 shrink-0"
                    />
                    <span
                      class="truncate"
                      :class="feature.included ? '' : 'line-through'"
                    >{{ feature.name }}</span>
                  </span>
                </UBadge>

                <UTooltip
                  v-if="getHiddenPlanFeatureCount(row.original) > 0"
                  :text="getPlanFeaturesTooltip(row.original)"
                >
                  <UBadge
                    color="neutral"
                    variant="outline"
                    size="sm"
                  >
                    +{{ getHiddenPlanFeatureCount(row.original) }}
                  </UBadge>
                </UTooltip>
              </div>
            </div>
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
          <template #isActive-cell="{ row }">
            <UBadge
              :color="getProductStatusColor(row.original)"
              variant="subtle"
            >
              {{ getProductStatusLabel(row.original) }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="primary"
                variant="ghost"
                icon="ph:link"
                :title="$t('admin.products.viewPage')"
                :to="`/products/${row.original.slug || row.original.id}`"
                target="_blank"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                @click="openModal(row.original)"
                :disabled="!hasAdminPerm('products:edit')"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                @click="deleteProduct(Number(row.original.id))"
                :disabled="!hasAdminPerm('products:edit')"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex justify-between items-center shrink-0 bg-white dark:bg-[#121214]">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          <span class="text-gray-900 dark:text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageCount"
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
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSortable } from '@vueuse/integrations/useSortable'

const { t, locale } = useI18n()

definePageMeta({ title: 'Products Management', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const { formatCurrencyAmount } = useCurrencyFormat()
const { getSetting, fetchSettings } = useSettings()

await fetchSettings()
const baseCurrency = computed(() => getSetting('currency', 'USD'))

const getProductStatusColor = (product: any) => {
  const status = product?.status || (product?.isActive === false ? 'inactive' : 'active')
  if (status === 'active') return 'success'
  if (status === 'hidden') return 'warning'
  return 'neutral'
}

const getProductStatusLabel = (product: any) => {
  const status = product?.status || (product?.isActive === false ? 'inactive' : 'active')
  if (status === 'active') return t('admin.products.active')
  if (status === 'hidden') return t('admin.products.hidden')
  return t('admin.products.inactive')
}

const columns = computed(() => [
  { accessorKey: 'drag', header: '' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'image', header: 'Image' },
  { accessorKey: 'name', header: t('admin.products.name') },
  { accessorKey: 'price', header: t('admin.products.price') },
  { accessorKey: 'type', header: t('admin.products.type') },
  { accessorKey: 'views', header: t('admin.products.views') },
  { accessorKey: 'isActive', header: t('admin.products.status') },
  {
    accessorKey: 'actions',
    header: t('admin.products.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
      },
    },
  },
])

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: productsData,
  pending,
  refresh,
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

type ProductRow = {
  id?: number | string
  type?: string
  metaData?: any
}

type PlanFeature = {
  name: string
  included: boolean
}

const parseJsonMaybe = (value: unknown) => {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const getProductMetaData = (product: ProductRow) => {
  const parsed = parseJsonMaybe(product?.metaData)
  return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {}
}

const isPlanFeatureProduct = (product: ProductRow) => ['subscription', 'topup'].includes(String(product?.type || ''))

const normalizePlanFeatures = (value: unknown): PlanFeature[] => {
  const parsed = parseJsonMaybe(value)
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((feature: any) => {
      if (typeof feature === 'string') {
        return {
          name: feature.trim(),
          included: true,
        }
      }

      return {
        name: String(feature?.name || '').trim(),
        included: feature?.included !== false,
      }
    })
    .filter((feature: PlanFeature) => feature.name)
}

const getProductPlanFeatures = (product: ProductRow) => {
  const metaData = getProductMetaData(product)
  const translatedFeatures = normalizePlanFeatures(metaData?.translations?.[locale.value]?.plan_features)

  if (translatedFeatures.length > 0) {
    return translatedFeatures
  }

  return normalizePlanFeatures(metaData?.plan_features)
}

const getVisiblePlanFeatures = (product: ProductRow) => getProductPlanFeatures(product).slice(0, 2)

const getHiddenPlanFeatureCount = (product: ProductRow) => Math.max(getProductPlanFeatures(product).length - 2, 0)

const getPlanFeaturesTooltip = (product: ProductRow) => getProductPlanFeatures(product)
  .map((feature) => `${feature.included ? '✓' : '✕'} ${feature.name}`)
  .join('\n')

const isModalOpen = ref(false)
const editingProduct = ref<any>(null)
const sortableTarget = computed<HTMLElement | null>(() => import.meta.client ? document.querySelector<HTMLElement>('.my-table-tbody') : null)

// 拖拽排序逻辑
useSortable(sortableTarget, paginatedProducts, {
  animation: 150,
  handle: '.cursor-move',
  onEnd: async () => {
    const total = totalItems.value
    const startIndex = (page.value - 1) * pageCount.value

    // 生成基于新顺序的排序数据
    const reorderedItems = paginatedProducts.value.map((item: any, index: number) => ({
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
} as any)

const openModal = (product?: any) => {
  if (product && typeof product === 'object') {
    editingProduct.value = JSON.parse(JSON.stringify(product))
  } else {
    editingProduct.value = undefined
  }
  isModalOpen.value = true
}

const deleteProduct = async (id: number) => {
  const isConfirmed = await confirm({
    title: t('admin.products.delete'),
    description: t('admin.products.confirmDelete'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: t('admin.common.success'),
      description: t('admin.products.deleteSuccess'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: e.data?.message || t('admin.products.deleteFailed'),
      color: 'error',
    })
  }
}
</script>
