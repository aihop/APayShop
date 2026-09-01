<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Top toolbar -->
    <div class="mb-4 flex shrink-0 items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <USelect
          v-model="selectedProduct"
          :items="productOptions"
          :placeholder="t('admin.cards.filterProduct', '按商品筛选卡密')"
          class="w-64"
          size="sm"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          size="sm"
          :loading="pending"
          class="hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="() => refresh()"
        />
      </div>
      <UButton
        v-if="hasAdminPerm('cards:edit')"
        color="primary"
        size="sm"
        icon="ph:file-arrow-up-bold"
        class="shadow-xs font-medium"
        @click="openModal"
      >
        {{ t('admin.cards.import', '导入卡密') }}
      </UButton>
    </div>

    <!-- Cards Table -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedCards"
          :columns="columns"
          :loading="pending"
          sticky
        >
          <template #product-cell="{ row }">
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getProductName(row.original.productId) }}</span>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.isUsed ? 'error' : 'success'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.isUsed ? t('admin.cards.status_used', '已使用') : t('admin.cards.status_available', '可用') }}
            </UBadge>
          </template>

          <template #orderId-cell="{ row }">
            <span
              v-if="row.original.orderId"
              class="text-gray-500 font-mono text-xs"
            >
              {{ row.original.orderId }}
            </span>
            <span
              v-else
              class="text-gray-400"
            >-</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
              {{ formatDateTime(row.original.createdAt) }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                size="xs"
                :disabled="row.original.isUsed || !hasAdminPerm('cards:edit')"
                @click="deleteCard(row.original.id)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-3.5 border-t border-gray-200/80 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214]">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          共 {{ totalItems }} 条卡密记录
        </span>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageSize"
          :max="5"
          size="sm"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Import Cards Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #content>
        <UCard
          class="bg-white dark:bg-[#121214] ring-1 ring-gray-200 dark:ring-gray-800"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ t('admin.cards.importTitle', '批量导入卡密') }}</h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:x-bold"
                size="xs"
                @click="closeModal"
              />
            </div>
          </template>

          <form
            class="space-y-4"
            @submit.prevent="handleImport"
          >
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {{ t('admin.cards.selectProduct', '关联卡密商品') }}
              </label>
              <USelect
                v-model="importProductId"
                :items="keyProductOptions"
                :placeholder="t('admin.cards.selectProductPlaceholder', '请选择卡密商品...')"
                class="w-full"
                required
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {{ t('admin.cards.cardList', '卡密列表（每行一条）') }}
              </label>
              <UTextarea
                v-model="importContent"
                :rows="8"
                class="font-mono text-xs w-full"
                :placeholder="t('admin.cards.cardListPlaceholder', '一行一条卡密，例如：\nAAAA-BBBB-CCCC\nDDDD-EEEE-FFFF')"
                required
              />
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                @click="closeModal"
              >
                {{ t('admin.common.cancel', '取消') }}
              </UButton>
              <UButton
                type="submit"
                color="primary"
                size="sm"
                :loading="isImporting"
              >
                {{ t('admin.cards.confirmImport', '确认导入') }}
              </UButton>
            </div>
          </form>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const isModalOpen = ref(false)
const selectedProduct = ref('')
const importProductId = ref('')
const importContent = ref('')
const isImporting = ref(false)

const {
  page,
  pageSize,
  totalItems,
  onPageChange,
  onNewItemAdded,
  onItemDeleted,
} = usePagination(10)

const { data: productsData } = await useFetch<any>('/api/admin/products')
const { data: cardsData, pending, refresh } = await useFetch<any>('/api/admin/cards', {
  query: computed(() => ({
    productId: selectedProduct.value || undefined,
  })),
})

const products = computed(() => productsData.value?.data || [])
const cards = computed(() => cardsData.value?.data || [])

watch(cards, (newCards) => {
  totalItems.value = newCards.length
}, { immediate: true })

watch(selectedProduct, () => {
  page.value = 1
})

const paginatedCards = computed(() => {
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  return cards.value.slice(start, end)
})

const productOptions = computed(() => [
  { label: t('admin.cards.allProducts', '全部卡密商品'), value: '' },
  ...products.value
    .filter((p: any) => p.type === 'key')
    .map((p: any) => ({ label: p.name, value: String(p.id) })),
])

const keyProductOptions = computed(() =>
  products.value
    .filter((p: any) => p.type === 'key')
    .map((p: any) => ({ label: p.name, value: String(p.id) }))
)

const columns = [
  { accessorKey: 'product', header: t('admin.cards.product', '关联商品') },
  { accessorKey: 'cardCode', header: t('admin.cards.cardCode', '卡密内容') },
  { accessorKey: 'status', header: t('admin.cards.status', '使用状态') },
  { accessorKey: 'orderId', header: t('admin.cards.orderId', '关联订单') },
  { accessorKey: 'createdAt', header: t('admin.cards.createdAt', '导入时间') },
  { accessorKey: 'actions', header: t('admin.common.actions', '操作') },
]

const getProductName = (productId: number) => {
  const product = products.value.find((p: any) => p.id === productId)
  return product ? product.name : `Product #${productId}`
}

const openModal = () => {
  importProductId.value = selectedProduct.value || (keyProductOptions.value[0]?.value || '')
  importContent.value = ''
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const handleImport = async () => {
  if (!importProductId.value || !importContent.value.trim()) return
  const cardsList = importContent.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (!cardsList.length) return
  isImporting.value = true
  try {
    const res: any = await $fetch('/api/admin/cards', {
      method: 'POST',
      body: {
        productId: Number(importProductId.value),
        cards: cardsList,
      },
    })
    if (res.code === 200) {
      toast.add({ title: t('admin.cards.importSuccess', `成功导入 ${cardsList.length} 条卡密`), color: 'success' })
      closeModal()
      await refresh()
      onNewItemAdded(cardsList.length)
    }
  } catch (error: any) {
    toast.add({ title: t('admin.cards.importError', '导入失败'), description: error?.data?.message || error?.message, color: 'error' })
  } finally {
    isImporting.value = false
  }
}

const deleteCard = async (id: number) => {
  if (!confirm(t('admin.cards.deleteConfirm', '确定删除该条卡密吗？'))) return
  try {
    const res: any = await $fetch(`/api/admin/cards/${id}`, { method: 'DELETE' })
    if (res.code === 200) {
      toast.add({ title: t('admin.cards.deleteSuccess', '删除成功'), color: 'success' })
      await refresh()
      onItemDeleted()
    }
  } catch (error: any) {
    toast.add({ title: t('admin.cards.deleteError', '删除失败'), description: error?.data?.message || error?.message, color: 'error' })
  }
}
</script>
