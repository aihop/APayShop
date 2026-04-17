<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Card Management</h1>
        <p class="text-gray-400 mt-2 text-sm">Manage license keys and activation codes for products</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal"
      >Import Cards</UButton>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0">
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
              {{ row.original.isUsed ? 'Used' : 'Available' }}
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
            <span class="text-gray-400 text-sm">
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

    <!-- Import Cards Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ width: 'sm:max-w-xl' }"
    >
      <template #content>
        <UCard
          class="bg-[#121214] ring-1 ring-gray-800"
          :ui="{ divide: 'divide-gray-800' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Import Cards</h3>
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
              label="Product"
              name="productId"
              required
            >
              <USelectMenu
                v-model="state.productId"
                :items="keyProducts"
                value-key="id"
                placeholder="Select a product"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Card Data"
              name="cardData"
              required
              help="Enter one card per line. Duplicate cards will be imported."
            >
              <UTextarea
                v-model="state.cardData"
                placeholder="CARD-KEY-1&#10;CARD-KEY-2&#10;CARD-KEY-3"
                :rows="8"
                class="font-mono text-sm"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-800">
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
                class="bg-purple-600 hover:bg-purple-500"
                :loading="isSaving"
                :disabled="!state.productId || !state.cardData.trim()"
              >
                Import {{ parsedCardCount }} Cards
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

definePageMeta({ title: 'Cards Management' })

const toast = useToast()

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'productName', header: 'Product' },
  { accessorKey: 'cardNumber', header: 'Card Number' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'orderId', header: 'Order ID' },
  { accessorKey: 'createdAt', header: 'Added At' },
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
      title: 'Error',
      description: 'No valid cards to import',
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
      title: 'Success',
      description: `Successfully imported ${cardNumbers.length} cards`,
      color: 'success',
    })

    isModalOpen.value = false
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to import cards',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const deleteCard = async (id: number) => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete Card',
    description: 'Are you sure you want to delete this card?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/cards/${id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: 'Success',
      description: 'Card deleted successfully',
      color: 'success',
    })
    refresh()
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete card',
      color: 'error',
    })
  }
}
</script>