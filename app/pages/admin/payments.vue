<template>
  <div>
    <div class="flex justify-between items-end mb-10">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.payments.page.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.payments.page.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.payments.page.add_method') }}</UButton>
    </div>

    <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl overflow-hidden">
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
            >{{ $t('admin.payments.badge.unconfigured') }}</UBadge>
            <UBadge
              v-else-if="row.original.hasLocalFiles"
              color="success"
              variant="subtle"
              size="xs"
            >{{ $t('admin.payments.badge.local_plugin') }}</UBadge>
            <UBadge
              v-else
              color="info"
              variant="subtle"
              size="xs"
            >{{ $t('admin.payments.badge.db_only') }}</UBadge>
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :icon="row.original.isLocalOnly ? 'ph:plug-bold' : 'ph:pencil-simple'"
              :label="row.original.isLocalOnly ? $t('admin.payments.table.configure') : ''"
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
      :title="form.id ? $t('admin.payments.modal.edit_title') : $t('admin.payments.modal.new_title')"
    >
      <form
        @submit.prevent="saveMethod"
        class="space-y-4"
      >
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('admin.payments.modal.name_label')">
            <UInput
              v-model="form.name"
              required
              class="w-full"
            />
          </UFormField>
          <UFormField :label="$t('admin.payments.modal.code_label')">
            <UInput
              v-model="form.code"
              required
              class="w-full"
              :disabled="!!form.id"
            />
          </UFormField>
        </div>

        <UFormField :label="$t('admin.payments.modal.icon_label')">
          <UInput
            v-model="form.iconUrl"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('admin.payments.modal.info_label')">
          <UTextarea
            v-model="form.info"
            class="h-full w-full font-mono text-sm"
            :rows="8"
          />
          <template #help>
            <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.info_help') }}</span>
          </template>
        </UFormField>

        <UFormField :label="$t('admin.payments.modal.create_label')">
          <UTextarea
            v-model="form.create"
            :rows="12"
            class="font-mono text-sm w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.create_help') }}</span>
          </template>
        </UFormField>

        <UFormField :label="$t('admin.payments.modal.callback_label')">
          <UTextarea
            v-model="form.callback"
            :rows="12"
            class="font-mono text-sm w-full"
          />
          <template #help>
            <span class="text-xs text-gray-500">{{ $t('admin.payments.modal.callback_help') }}</span>
          </template>
        </UFormField>

        <UFormField :label="$t('admin.payments.modal.config_label')">
          <UTextarea
            v-model="form.configJson"
            :rows="12"
            class="font-mono text-sm w-full"
            @input="onJsonChange"
          />
          <p
            v-if="hasJsonError"
            class="text-xs text-red-500 mt-1"
          >{{ $t('admin.payments.modal.config_invalid') }}</p>
        </UFormField>

        <UFormField>
          <UCheckbox
            v-model="form.isActive"
            :label="$t('admin.payments.modal.enable_label')"
          />
        </UFormField>

        <div class="flex justify-end gap-3 mt-8">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isModalOpen = false"
          >{{ $t('admin.payments.modal.cancel') }}</UButton>
          <UButton
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
            type="submit"
            :loading="isSaving"
          >{{ $t('admin.payments.modal.save') }}</UButton>
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
  useI18n,
} from '#imports'

definePageMeta({ title: 'Payment Methods' })

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const columns = [
  { accessorKey: 'name', header: t('admin.payments.table.name') },
  { accessorKey: 'code', header: t('admin.payments.table.code') },
  { accessorKey: 'isActive', header: t('admin.payments.table.status') },
  { accessorKey: 'actions', header: t('admin.payments.table.actions') },
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
      title: t('admin.payments.toast.error'),
      description: t('admin.payments.toast.invalid_json'),
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
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.saved'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.save_failed'),
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
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.status_updated'),
      color: 'success',
    })
  } catch (e: any) {
    row.isActive = !row.isActive // revert on fail
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.status_failed'),
      color: 'error',
    })
  }
}

const deleteMethod = async (id: number) => {
  const isConfirmed = await confirm({
    title: t('admin.payments.confirm.delete_title'),
    description: t('admin.payments.confirm.delete_desc'),
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/payments/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: t('admin.payments.toast.success'),
      description: t('admin.payments.toast.deleted'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('admin.payments.toast.error'),
      description: e.data?.message || t('admin.payments.toast.delete_failed'),
      color: 'error',
    })
  }
}
</script>
