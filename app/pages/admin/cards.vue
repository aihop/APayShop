<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.cards.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.cards.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal"
      >{{ $t('admin.cards.import') }}</UButton>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto">
        <UTable
          :data="paginatedCards"
          :columns="columns"
          :loading="pending"
          sticky
        >
          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.isUsed ? 'red' : 'success'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.isUsed ? $t('admin.cards.status_used') : $t('admin.cards.status_available') }}
            </UBadge>
          </template>

          <template #orderId-cell="{ row }">
            <span
              v-if="row.original.orderId"
              class="text-gray-400 font-mono text-xs"
            >
              {{ row.original.orderId }}
            </span>
            <span
              v-else
              class="text-gray-600"
            >-</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-gray-500 dark:text-gray-400 text-sm">
              {{ new Date(row.original.createdAt).toLocaleString() }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                color="red"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                :disabled="row.original.isUsed"
                @click="deleteCard(row.original.id)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.cards.showing', {
            from: Math.min((page - 1) * pageSize + 1, totalItems),
            to: Math.min(page * pageSize, totalItems),
            total: totalItems
          }) }}
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

    <!-- Import Cards Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ width: 'sm:max-w-xl' }"
    >
      <template #content>
        <UCard
          class="bg-white dark:bg-[#121214] ring-1 ring-gray-200 dark:ring-gray-800"
          :ui="{ divide: 'divide-gray-200 dark:divide-gray-800' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.cards.importTitle') }}</h3>
              <UButton
                color="gray"
                variant="ghost"
                icon="ph:x"
                class="-my-1"
                @click="isModalOpen = false"
              />
            </div>
          </template>

          <UForm
            :state="state"
            @submit="onSubmit"
            class="space-y-6"
          >
            <UFormField
              :label="$t('admin.cards.form_product')"
              name="productId"
              required
            >
              <USelectMenu
                v-model="state.productId"
                :items="keyProducts"
                value-key="id"
                :placeholder="$t('admin.cards.form_product_placeholder')"
                class="w-full"
              />
            </UFormField>

            <UFormField
              :label="$t('admin.cards.form_cardData')"
              name="cardData"
              required
              :help="$t('admin.cards.form_cardData_help')"
            >
              <UTextarea
                v-model="state.cardData"
                :placeholder="$t('admin.cards.form_cardData_placeholder')"
                :rows="8"
                class="font-mono text-sm"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <UButton
                color="gray"
                variant="ghost"
                @click="isModalOpen = false"
              >
                {{ $t('admin.cards.cancel') }}
              </UButton>
              <UButton
                type="submit"
                color="primary"
                class="bg-purple-600 hover:bg-purple-500"
                :loading="isSaving"
                :disabled="!state.productId || !state.cardData.trim()"
              >
                {{ $t('admin.cards.import_button', { count: parsedCardCount }) }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ title: 'Cards Management' })

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const columns = computed(() => [
  { accessorKey: 'id', header: t('admin.cards.col_id') },
  { accessorKey: 'productName', header: t('admin.cards.col_product') },
  { accessorKey: 'cardNumber', header: t('admin.cards.col_cardNumber') },
  { accessorKey: 'status', header: t('admin.cards.col_status') },
  { accessorKey: 'orderId', header: t('admin.cards.col_orderId') },
  { accessorKey: 'createdAt', header: t('admin.cards.col_createdAt') },
  {
    accessorKey: 'actions',
    header: t('admin.cards.col_actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
      },
    },
  },
])

// Pagination
const { page, pageSize, onPageChange } = usePagination(15)

// Fetch cards
const {
  data: cardsData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/cards', {
  query: {
    page,
    pageSize,
  },
  watch: [page],
})

// Fetch products for the dropdown (only key type products)
const { data: productsData } = await useFetch<any>('/api/admin/products')

const keyProducts = computed(() => {
  return (productsData.value?.data || []).filter(
    (p: any) => p.type === 'key' && p.isActive
  )
})

const totalItems = computed(() => cardsData.value?.total || 0)
const paginatedCards = computed(() => cardsData.value?.data || [])

// Modal & Form State
const isModalOpen = ref(false)
const isSaving = ref(false)
const state = ref({
  productId: '',
  cardData: '',
})

const parsedCardCount = computed(() => {
  if (!state.value.cardData) return 0
  return state.value.cardData.split('\n').filter((line) => line.trim()).length
})

const openModal = () => {
  state.value = {
    productId: '',
    cardData: '',
  }
  isModalOpen.value = true
}

const onSubmit = async () => {
  if (!state.value.productId || !state.value.cardData.trim()) return

  const cardNumbers = state.value.cardData
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)

  if (cardNumbers.length === 0) {
    toast.add({
      title: t('admin.common.error'),
      description: t('admin.cards.toast_no_valid_cards'),
      color: 'error',
    })
    return
  }

  isSaving.value = true
  try {
    await $fetch('/api/admin/cards', {
      method: 'POST',
      body: {
        productId: parseInt(state.value.productId),
        cardNumbers,
      },
    })

    toast.add({
      title: t('admin.common.success'),
      description: t('admin.cards.toast_import_success', { count: cardNumbers.length }),
      color: 'success',
    })

    isModalOpen.value = false
    refresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: t('admin.cards.toast_import_error'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const deleteCard = async (id: number) => {
  const isConfirmed = await confirm({
    title: t('admin.cards.delete_title'),
    description: t('admin.cards.delete_confirm'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/cards/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('admin.common.success'),
      description: t('admin.cards.toast_delete_success'),
      color: 'success',
    })
    refresh()
  } catch (e: any) {
    toast.add({
      title: t('admin.common.error'),
      description: t('admin.cards.toast_delete_error'),
      color: 'error',
    })
  }
}
</script>
