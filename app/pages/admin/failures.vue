<template>
  <div>
    <div class="flex justify-between items-end mb-10">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.failures.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.failures.subtitle') }}</p>
      </div>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl overflow-hidden">
      <UTable
        :columns="columns"
        :data="failures || []"
        :loading="pending"
      >
        <template #id-cell="{ row }">
          <span class="text-xs text-gray-400 font-mono">{{ String(row.original.id || '') }}</span>
        </template>
        <template #visitorId-cell="{ row }">
          <span
            v-if="row.original.visitorId"
            class="text-xs text-gray-500 font-mono cursor-pointer hover:text-primary-400 transition-colors"
            :title="String(row.original.visitorId)"
            @click="copyVisitorId(String(row.original.visitorId))"
          >
            {{ String(row.original.visitorId).substring(0, 8) }}...
          </span>
          <span
            v-else
            class="text-xs text-gray-600"
          >-</span>
        </template>
        <template #orderId-cell="{ row }">
          <span class="text-xs text-gray-400 font-mono">{{ String(row.original.orderId || '').substring(0, 8) }}...</span>
        </template>

        <template #cardBin-cell="{ row }">
          <span class="font-mono text-gray-300">{{ row.original.cardBin || $t('admin.failures.n/a') }}</span>
        </template>

        <template #amount-cell="{ row }">
          ${{ Number(row.original.amount || 0).toFixed(2) }}
        </template>

        <template #reason-cell="{ row }">
          <span class="text-red-400 text-sm">{{ row.original.reason }}</span>
        </template>

        <template #payMethod-cell="{ row }">
          <UBadge
            color="neutral"
            variant="subtle"
            class="capitalize"
          >
            {{ row.original.payMethod || $t('admin.failures.unknown') }}
          </UBadge>
        </template>

        <template #createdAt-cell="{ row }">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ new Date(String(row.original.createdAt || '')).toLocaleString() }}</span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:eye"
            @click="viewDetails(row.original)"
          />
        </template>
      </UTable>
    </div>

    <!-- Details Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ content: 'bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800 sm:max-w-2xl' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('admin.failures.details') }}</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x"
              class="-my-1"
              @click="isModalOpen = false"
            />
          </div>

          <div
            v-if="selectedFailure"
            class="space-y-4"
          >
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.id') }}</span>
                <span class="text-gray-900 dark:text-white">{{ selectedFailure.id }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.orderId') }}</span>
                <span class="text-gray-900 dark:text-white font-mono text-sm">{{ selectedFailure.orderId }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.amount') }}</span>
                <span class="text-gray-900 dark:text-white">${{ Number(selectedFailure.amount || 0).toFixed(2) }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.cardBin') }}</span>
                <span class="text-gray-900 dark:text-white font-mono">{{ selectedFailure.cardBin || $t('admin.failures.n/a') }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.customerEmail') }}</span>
                <span class="text-gray-900 dark:text-white">{{ selectedFailure.contactEmail || $t('admin.failures.n/a') }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.paymentMethod') }}</span>
                <span class="text-gray-900 dark:text-white capitalize">{{ selectedFailure.payMethod || $t('admin.failures.unknown') }}</span>
              </div>
              <div>
                <span class="block text-xs text-gray-500 mb-1">{{ $t('admin.failures.time') }}</span>
                <span class="text-gray-900 dark:text-white">{{ new Date(selectedFailure.createdAt).toLocaleString() }}</span>
              </div>
            </div>

            <div class="mt-6">
              <span class="block text-xs text-gray-500 mb-2">{{ $t('admin.failures.failureReason') }}</span>
              <div class="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400">
                {{ selectedFailure.reason }}
              </div>
            </div>

            <div
              v-if="selectedFailure.rawResponse"
              class="mt-4"
            >
              <span class="block text-xs text-gray-500 mb-2">{{ $t('admin.failures.rawGatewayResponse') }}</span>
              <div class="p-3 bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <pre class="text-xs text-gray-500 dark:text-gray-400 m-0">{{ formatJson(selectedFailure.rawResponse) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '#imports'
definePageMeta({ title: 'admin.failures.title' })

const { t } = useI18n()
const toast = useToast()
const router = useRouter() // 顶层取;勿在下方 onResponseError 回调里调 useRouter()

const columns = [
  { accessorKey: 'id', header: () => t('admin.failures.id') },
  { accessorKey: 'orderId', header: () => t('admin.failures.orderId') },
  { accessorKey: 'visitorId', header: () => t('admin.failures.visitor') },
  { accessorKey: 'cardBin', header: () => t('admin.failures.cardBin') },
  { accessorKey: 'reason', header: () => t('admin.failures.reason') },
  { accessorKey: 'amount', header: () => t('admin.failures.amount') },
  { accessorKey: 'payMethod', header: () => t('admin.failures.method') },
  { accessorKey: 'createdAt', header: () => t('admin.failures.date') },
  { accessorKey: 'actions', header: () => t('admin.failures.actions') },
]

const { data: failuresData, pending } = await useFetch<any>(
  '/api/admin/failures',
  {
    onResponseError({ response }) {
      if (response.status === 401) {
        router.push('/admin/login')
      }
    },
  }
)

const failures = computed(() => failuresData.value || [])

const isModalOpen = ref(false)
const selectedFailure = ref<any>(null)

const copyVisitorId = (id: string) => {
  if (!id) return
  navigator.clipboard.writeText(id)
  toast.add({
    title: t('admin.failures.copied'),
    description: t('admin.failures.copiedDescription'),
    color: 'success',
  })
}

const viewDetails = (record: any) => {
  selectedFailure.value = record
  isModalOpen.value = true
}

const formatJson = (str: string) => {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
</script>