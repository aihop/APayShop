<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <div class="flex justify-between items-end mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ $t('admin.customers.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ $t('admin.customers.subtitle') }}</p>
      </div>
      <UButton
        v-if="activeTab === 'users'"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white"
        icon="ph:plus-bold"
        @click="openModal()"
      >{{ $t('admin.users.add') }}</UButton>
    </div>

    <UTabs
      v-model="activeTab"
      :items="tabs"
      class="mb-4"
    />

    <!-- Customers Tab Content -->
    <div
      v-if="activeTab === 'customers'"
      class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0"
    >
      <div class="flex-1 overflow-auto custom-scrollbar">
        <UTable
          :data="paginatedCustomers"
          :columns="columns"
          :loading="pending"
          class="min-w-full"
        >
          <template #email-cell="{ row }">
            <span :class="row.original.email === 'Anonymous' ? 'text-gray-500 italic' : 'text-white font-medium'">
              {{ row.original.email }}
            </span>
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

          <template #totalSpent-cell="{ row }">
            <span class="text-emerald-400 font-medium">${{ Number(row.original.totalSpent || 0).toFixed(2) }}</span>
          </template>

          <template #totalOrders-cell="{ row }">
            <span>{{ row.original.totalOrders }}</span>
            <span
              v-if="Number(row.original.unpaidOrders || 0) > 0"
              class="text-xs text-red-400 ml-1"
              title="Failed/Pending orders"
            >
              ({{ row.original.unpaidOrders }} {{ $t('admin.customers.failed') }})
            </span>
          </template>

          <template #lastOrderAt-cell="{ row }">
            <span class="text-sm text-gray-400">{{ new Date(Number(row.original.lastOrderAt || 0)).toLocaleString() }}</span>
          </template>
        </UTable>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-800/50 flex justify-between items-center shrink-0 bg-[#121214] rounded-b-2xl">
        <div class="text-sm text-gray-400">
          {{ $t('admin.common.showing') }} <span class="text-white">{{ totalItems > 0 ? (page - 1) * pageCount + 1 : 0 }}</span> {{ $t('admin.common.to') }} <span class="text-white">{{ Math.min(page * pageCount, totalItems) }}</span> {{ $t('admin.common.of') }} <span class="text-white">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :total="totalItems"
          :page-count="pageCount"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Users Tab Content -->
    <div
      v-else-if="activeTab === 'users'"
      class="bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col flex-1 min-h-0"
    >
      <div class="flex-1 overflow-auto custom-scrollbar">
        <UTable
          :data="paginatedUsers"
          :columns="userColumns"
          :loading="usersPending"
          class="min-w-full"
        >
          <template #createdAt-cell="{ row }">
            <span class="text-sm text-gray-400">{{ new Date(String(row.original.createdAt || '')).toLocaleString() }}</span>
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

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-800/50 flex justify-between items-center shrink-0 bg-[#121214] rounded-b-2xl">
        <div class="text-sm text-gray-400">
          <span class="text-white">{{ usersTotalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="usersPage"
          :total="usersTotalItems"
          :page-count="usersPageCount"
          @update:page="(val) => onUsersPageChange(val, () => usersRefresh())"
        />
      </div>
    </div>

    <!-- User Modal -->
    <UModal
      v-model:open="isModalOpen"
      :ui="{ content: 'bg-[#121214] border border-gray-800' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">{{ form.id ? $t('admin.users.edit') : $t('admin.users.add') }}</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
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
                class="text-white w-full"
                :disabled="!!form.id && form.username === 'admin'"
              />
            </UFormField>

            <UFormField :label="form.id ? 'Password (leave blank to keep current)' : 'Password'">
              <UInput
                v-model="form.password"
                type="password"
                :required="!form.id"
                class="text-white w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-800">
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

definePageMeta({ title: 'Customers & Users' })

const { t } = useI18n()
const toast = useToast()

const activeTab = ref('customers')

const tabs = computed(() => [
  { label: t('admin.customers.title'), value: 'customers', icon: 'ph:users' },
  {
    label: t('admin.users.registered'),
    value: 'users',
    icon: 'ph:user-circle',
  },
])

const columns = computed(() => [
  { accessorKey: 'email', header: t('admin.customers.email') },
  { accessorKey: 'visitorId', header: t('admin.customers.visitorId') },
  { accessorKey: 'totalSpent', header: t('admin.customers.totalSpent') },
  { accessorKey: 'totalOrders', header: t('admin.customers.orders') },
  { accessorKey: 'lastOrderAt', header: t('admin.customers.lastActive') },
])

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: customersData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/customers', {
  query: { page, pageSize: pageCount },
  watch: [page],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const paginatedCustomers = computed(() => {
  return customersData.value?.data || []
})

const totalItems = computed(() => customersData.value?.total || 0)

const copyVisitorId = (id: string) => {
  if (!id) return
  navigator.clipboard.writeText(id)
  toast.add({
    title: 'Copied',
    description: 'Visitor ID copied to clipboard',
    color: 'success',
  })
}

// --- Users (Registered) Logic ---

const userColumns = computed(() => [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'username', header: t('admin.users.username') },
  { accessorKey: 'createdAt', header: t('admin.users.createdAt') },
  { accessorKey: 'actions', header: t('admin.users.actions') },
])

const {
  page: usersPage,
  pageSize: usersPageCount,
  onPageChange: onUsersPageChange,
} = usePagination(15)

const {
  data: usersData,
  pending: usersPending,
  refresh: usersRefresh,
} = await useFetch<any>('/api/admin/users', {
  query: {
    page: usersPage,
    pageSize: usersPageCount,
  },
  watch: [usersPage],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const usersTotalItems = computed(() => usersData.value?.total || 0)

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
    form.password = '' // Don't show password hash
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
    const url = form.id ? `/api/admin/users/${form.id}` : '/api/admin/users'
    const method = form.id ? 'PUT' : 'POST'

    // Only send password if it was filled out (important for PUT requests)
    const payload: any = { username: form.username }
    if (form.password) {
      payload.password = form.password
    }

    await $fetch(url, {
      method,
      body: payload,
    })

    isModalOpen.value = false
    await usersRefresh()
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
  const { confirm } = useConfirm()
  const isConfirmed = await confirm({
    title: 'Delete User',
    description: 'Are you sure you want to delete this user?',
  })

  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    })
    await usersRefresh()
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
