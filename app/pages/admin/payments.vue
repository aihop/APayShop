<template>
  <div>
    <div class="flex justify-between items-end mb-10">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Payment Methods</h1>
        <p class="text-gray-400 mt-2 text-sm">Configure gateways and payment options.</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >Add Method</UButton>
    </div>

    <div class="bg-[#121214] border border-gray-800/50 rounded-2xl overflow-hidden">
      <UTable
        :columns="columns"
        :data="methods || []"
        :loading="pending"
      >
        <template #isActive-cell="{ row }">
          <div class="flex items-center gap-2">
            <USwitch
              :model-value="Boolean(row.original.isActive)"
              :disabled="row.original.isLocalOnly"
              @update:model-value="val => { if(!row.original.isLocalOnly) { row.original.isActive = val; toggleActive(row.original) } }"
            />
            <UBadge
              v-if="row.original.isLocalOnly"
              color="warning"
              variant="subtle"
              size="xs"
            >Unconfigured</UBadge>
            <UBadge
              v-else-if="row.original.hasLocalFiles"
              color="success"
              variant="subtle"
              size="xs"
            >Local Plugin</UBadge>
            <UBadge
              v-else
              color="info"
              variant="subtle"
              size="xs"
            >DB Only</UBadge>
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :icon="row.original.isLocalOnly ? 'ph:plug-bold' : 'ph:pencil-simple'"
              :label="row.original.isLocalOnly ? 'Configure' : ''"
              @click="openModal(row.original)"
            />
            <UButton
              v-if="!row.original.isLocalOnly"
              color="error"
              variant="ghost"
              icon="ph:trash"
              @click="deleteMethod(Number(row.original.id))"
            />
          </div>
        </template>
      </UTable>
    </div>

    <!-- Payment Method Modal -->
    <FullScreenModal
      v-model="isModalOpen"
      maxWidth="sm:max-w-6xl"
      :title="form.id ? 'Edit Payment Method' : 'New Payment Method'"
    >
      <form
        @submit.prevent="saveMethod"
        class="space-y-4"
      >
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Name (e.g. Stripe)">
            <UInput
              v-model="form.name"
              required
              class="w-full"
            />
          </UFormField>
          <UFormField label="Code (e.g. stripe)">
            <UInput
              v-model="form.code"
              required
              class="w-full"
              :disabled="!!form.id"
            />
          </UFormField>
        </div>

        <UFormField label="Icon URL (Optional)">
          <UInput
            v-model="form.iconUrl"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Payment Info HTML (Optional)">
          <UTextarea
            v-model="form.info"
            class="h-full w-full font-mono text-sm"
            :rows="8"
          />
          <template #help>
            <span class="text-xs text-gray-500">HTML injected into the checkout modal.</span>
          </template>
        </UFormField>

        <UFormField label="Create Script (JS)">
          <UTextarea
            v-model="form.create"
            :rows="12"
            class="font-mono text-sm w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">Node.js sandbox script executed when user initiates payment.</span>
          </template>
        </UFormField>

        <UFormField label="Callback Script (JS)">
          <UTextarea
            v-model="form.callback"
            :rows="12"
            class="font-mono text-sm w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">Node.js sandbox script executed when a webhook is received.</span>
          </template>
        </UFormField>

        <UFormField label="Configuration (JSON format)">
          <UTextarea
            v-model="form.configJson"
            :rows="12"
            class="font-mono text-sm w-full"
            @input="onJsonChange"
          />
          <p
            v-if="hasJsonError"
            class="text-xs text-red-500 mt-1"
          >Invalid JSON format</p>
        </UFormField>

        <UFormField>
          <UCheckbox
            v-model="form.isActive"
            label="Enable this payment method"
          />
        </UFormField>

        <div class="flex justify-end gap-3 mt-8">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isModalOpen = false"
          >Cancel</UButton>
          <UButton
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
            type="submit"
            :loading="isSaving"
          >Save</UButton>
        </div>
      </form>
    </FullScreenModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  definePageMeta,
  useToast,
  useFetch,
  useCookie,
  useRouter,
} from '#imports'

definePageMeta({ title: 'Payment Methods' })

const toast = useToast()

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'isActive', header: 'Status' },
  { accessorKey: 'actions', header: 'Actions' },
]

const {
  data: methods,
  pending,
  refresh,
} = await useFetch('/api/admin/payments', {
  onResponseError({ response }) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const isSaving = ref(false)
const isModalOpen = ref(false)
const form = reactive({
  id: null as number | null,
  name: '',
  code: '',
  iconUrl: '',
  configJson: '{}',
  info: '',
  create: '',
  callback: '',
  isActive: false,
})

const hasJsonError = ref(false)

const onJsonChange = () => {
  try {
    JSON.parse(form.configJson)
    hasJsonError.value = false
  } catch (e) {
    hasJsonError.value = true
  }
}

const openModal = (method?: any) => {
  hasJsonError.value = false
  if (method) {
    Object.assign(form, method)
    if (typeof form.configJson !== 'string') {
      form.configJson = JSON.stringify(form.configJson || {}, null, 2)
    }
  } else {
    Object.assign(form, {
      id: null,
      name: '',
      code: '',
      iconUrl: '',
      configJson: '{}',
      info: '',
      create: '',
      callback: '',
      isActive: false,
    })
  }
  isModalOpen.value = true
}

const saveMethod = async () => {
  // Validate JSON
  try {
    if (form.configJson) JSON.parse(form.configJson)
  } catch (e) {
    toast.add({
      title: 'Error',
      description: 'Invalid JSON in configuration',
      color: 'error',
    })
    return
  }

  isSaving.value = true
  try {
    const url = form.id
      ? `/api/admin/payments/${form.id}`
      : '/api/admin/payments'
    const method = form.id ? 'PUT' : 'POST'

    await $fetch(url, {
      method,
      body: form,
    })

    isModalOpen.value = false
    await refresh()
    toast.add({
      title: 'Success',
      description: 'Payment method saved successfully',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to save payment method',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const toggleActive = async (row: any) => {
  try {
    await $fetch(`/api/admin/payments/${row.id}`, {
      method: 'PUT',
      body: { isActive: row.isActive },
    })
    toast.add({
      title: 'Success',
      description: 'Status updated successfully',
      color: 'success',
    })
  } catch (e: any) {
    row.isActive = !row.isActive // revert on fail
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to update status',
      color: 'error',
    })
  }
}

const deleteMethod = async (id: number) => {
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete Payment Method',
    description: 'Are you sure? This might affect existing orders.'
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/payments/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: 'Success',
      description: 'Payment method deleted successfully',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete method',
      color: 'error',
    })
  }
}
</script>
