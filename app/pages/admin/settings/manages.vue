<template>
  <!-- 设置族成员页:套 settings 同款外壳与共享左栏导航,自身保留独立路由 -->
  <div class="max-w-5xl mx-auto pb-12">
    <div class="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <UIcon
            name="ph:users-four"
            class="w-8 h-8 text-purple-500"
          />
          {{ $t('admin.users.title') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.users.subtitle') }}</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.users.add') }}</UButton>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <AdminSettingsNav
        active="users"
        @select="goToSettingsTab"
      />

      <div class="lg:col-span-9">
        <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl overflow-hidden flex flex-col min-h-[calc(100vh-18rem)]">
          <div class="flex-1 overflow-auto">
            <UTable
              :data="paginatedUsers"
              :columns="columns"
              :loading="pending"
              class="min-w-full"
            >
              <template #createdAt-cell="{ row }">
                <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="ph:pencil-simple"
                    @click="openModal(row.original)"
                    :disabled="row.original.username === 'admin'"
                    :title="row.original.username === 'admin' ? 'Use Profile page to edit admin' : ''"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="ph:trash"
                    @click="deleteUser(Number(row.original.id))"
                    :disabled="row.original.username === 'admin'"
                    :title="row.original.username === 'admin' ? 'Cannot delete main admin' : ''"
                  />
                </div>
              </template>
            </UTable>
          </div>

          <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex justify-between items-center shrink-0 bg-white dark:bg-[#121214]">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              <span class="text-gray-900 dark:text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
            </div>
            <UPagination
              v-model="page"
              :total="totalItems"
              :page-count="pageCount"
              @update:page="(val) => onPageChange(val, () => refresh())"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- User Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ content: 'bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">{{ form.id ? $t('admin.users.edit') : $t('admin.users.add') }}</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x-bold"
              class="-my-1"
              @click="isModalOpen = false"
            />
          </div>

          <form
            @submit.prevent="saveUser"
            class="space-y-6"
          >
            <UFormField :label="$t('admin.users.username')">
              <UInput
                v-model="form.username"
                required
                class="text-gray-900 dark:text-white w-full"
                :disabled="!!form.id && form.username === 'admin'"
              />
            </UFormField>

            <UFormField :label="form.id ? 'Password (leave blank to keep current)' : 'Password'">
              <UInput
                v-model="form.password"
                type="password"
                :required="!form.id"
                class="text-gray-900 dark:text-white w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <UButton
                color="neutral"
                variant="ghost"
                @click="isModalOpen = false"
              >{{ $t('admin.common.cancel') }}</UButton>
              <UButton
                type="submit"
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white"
                :loading="isSaving"
              >{{ $t('admin.common.save') }}</UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { definePageMeta, useI18n, useToast, useConfirm, useFetch, useRouter, navigateTo } from '#imports'
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'

const { t } = useI18n()
const { formatDateTime } = useFormatTime()

definePageMeta({ title: 'Users Management', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()

// 共享导航上点了 settings 页内 tab → 跳回 settings 并落到对应 tab(?tab= 由 settings 解析)
const goToSettingsTab = (tabId: string) => {
  if (isSettingsTabId(tabId)) {
    navigateTo({ path: '/admin/settings', query: { tab: tabId } })
  }
}

const columns = computed(() => [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'username', header: t('admin.users.username') },
  { accessorKey: 'createdAt', header: t('admin.users.createdAt') },
  { accessorKey: 'actions', header: t('admin.users.actions') },
])

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: usersData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/admins', {
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
const totalItems = computed(() => usersData.value?.total || 0)

const paginatedUsers = computed(() => {
  return usersData.value?.data || []
})

const isModalOpen = ref(false)
const isSaving = ref(false)

const form = reactive({
  id: null as number | null,
  username: '',
  password: '',
})

const openModal = (user?: any) => {
  if (user) {
    form.id = user.id
    form.username = user.username
    form.password = ''
  } else {
    form.id = null
    form.username = ''
    form.password = ''
  }
  isModalOpen.value = true
}

const saveUser = async () => {
  isSaving.value = true
  try {
    const url = form.id ? `/api/admin/admins/${form.id}` : '/api/admin/admins'
    const method = form.id ? 'PUT' : 'POST'

    const payload: any = { username: form.username }
    if (form.password) {
      payload.password = form.password
    }

    await $fetch(url, {
      method,
      body: payload,
    })

    isModalOpen.value = false
    await refresh()
    toast.add({
      title: 'Success',
      description: `User ${form.id ? 'updated' : 'created'} successfully`,
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description:
        e.data?.message || `Failed to ${form.id ? 'update' : 'create'} user`,
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const deleteUser = async (id: number) => {
  const isConfirmed = await confirm({
    title: 'Delete Admin User',
    description: 'Are you sure you want to delete this admin user?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/admins/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.add({
      title: 'Success',
      description: 'User deleted successfully',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to delete user',
      color: 'error',
    })
  }
}
</script>
