<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.customers.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{{ $t('admin.customers.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2.5 shrink-0">
        <UButton
          v-if="activeTab === 'users' && hasAdminPerm('customers:edit')"
          color="primary"
          icon="ph:plus-bold"
          class="shadow-xs font-medium"
          @click="openModal()"
        >
          {{ $t('admin.users.add') }}
        </UButton>
      </div>
    </div>

    <!-- Toolbar: Tabs on left, Search on right -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
      <UTabs
        v-model="activeTab"
        :items="tabs"
        class="w-full sm:w-auto"
      />

      <div class="flex items-center gap-2.5 w-full sm:w-auto">
        <!-- Search Input -->
        <div class="relative flex-1 sm:w-72">
          <UInput
            v-model="searchInput"
            icon="ph:magnifying-glass"
            :placeholder="$t('admin.customers.search_placeholder') || '搜索客户邮箱、访客ID...'"
            size="sm"
            class="w-full text-xs"
          >
            <template
              v-if="searchInput"
              #trailing
            >
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                @click="searchInput = ''"
              >
                <UIcon
                  name="ph:x-circle-fill"
                  class="w-3.5 h-3.5"
                />
              </button>
            </template>
          </UInput>
        </div>

        <!-- Refresh Button -->
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="ph:arrows-clockwise"
          :loading="activeTab === 'customers' ? pending : usersPending"
          @click="activeTab === 'customers' ? refresh() : usersRefresh()"
        />
      </div>
    </div>

    <!-- Customers Tab Content -->
    <div
      v-if="activeTab === 'customers'"
      class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-xs overflow-hidden flex flex-col flex-1 min-h-0"
    >
      <div class="flex-1 overflow-auto custom-scrollbar">
        <UTable
          :data="paginatedCustomers"
          :columns="columns"
          :loading="pending"
          class="min-w-full"
        >
          <template #email-cell="{ row }">
            <span :class="row.original.email === 'Anonymous' || row.original.email === '匿名访客' ? 'text-gray-500 italic' : 'text-gray-900 dark:text-white font-medium'">
              {{ row.original.email }}
            </span>
          </template>

          <template #visitorId-cell="{ row }">
            <span
              v-if="row.original.visitorId"
              class="text-xs text-gray-500 font-mono cursor-pointer hover:text-primary-500 transition-colors"
              :title="String(row.original.visitorId)"
              @click="copyVisitorId(String(row.original.visitorId))"
            >
              {{ String(row.original.visitorId).substring(0, 8) }}...
            </span>
            <span
              v-else
              class="text-xs text-gray-400"
            >-</span>
          </template>

          <template #totalSpent-cell="{ row }">
            <span class="text-emerald-500 font-medium font-mono">{{ formatCurrencyTotals(row.original.totalSpentByCurrency) }}</span>
          </template>

          <template #totalOrders-cell="{ row }">
            <span class="font-mono font-medium">{{ row.original.totalOrders }}</span>
            <span
              v-if="Number(row.original.unpaidOrders || 0) > 0"
              class="text-xs text-red-500 ml-1 font-mono"
              :title="$t('admin.customers.failed')"
            >
              ({{ row.original.unpaidOrders }} {{ $t('admin.customers.failed') }})
            </span>
          </template>

          <template #lastOrderAt-cell="{ row }">
            <span class="text-sm text-gray-500 dark:text-gray-400 font-mono">{{ formatDateTime(row.original.lastOrderAt) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:eye"
              @click="openCustomerDetail(row.original)"
            />
          </template>
        </UTable>

        <!-- Empty State -->
        <div
          v-if="paginatedCustomers.length === 0 && !pending"
          class="flex flex-col items-center justify-center py-16 text-center px-4"
        >
          <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
            <UIcon
              name="ph:users"
              class="w-6 h-6"
            />
          </div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ searchKeyword ? $t('admin.customers.no_customers_found') : $t('admin.common.noData') }}
          </p>
          <UButton
            v-if="searchKeyword"
            color="primary"
            variant="soft"
            size="xs"
            class="mt-3"
            icon="ph:arrow-counter-clockwise"
            @click="searchInput = ''; searchKeyword = ''"
          >
            {{ $t('admin.customers.clear_search') }}
          </UButton>
        </div>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-200/80 dark:border-gray-800/60 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.common.showing') }} <span class="text-gray-900 dark:text-white font-medium">{{ totalItems > 0 ? Math.min(totalItems, (page - 1) * pageCount + 1) : 0 }}</span> {{ $t('admin.common.to') }} <span class="text-gray-900 dark:text-white font-medium">{{ Math.min(page * pageCount, totalItems) }}</span> {{ $t('admin.common.of') }} <span class="text-gray-900 dark:text-white font-medium">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageCount"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Users Tab Content -->
    <div
      v-else-if="activeTab === 'users'"
      class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-xs overflow-hidden flex flex-col flex-1 min-h-0"
    >
      <div class="flex-1 overflow-auto custom-scrollbar">
        <UTable
          :data="paginatedUsers"
          :columns="userColumns"
          :loading="usersPending"
          class="min-w-full"
        >
          <template #username-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-gray-900 dark:text-white font-medium">{{ row.original.username || row.original.email }}</span>
              <span v-if="row.original.nickname" class="text-xs text-gray-400">({{ row.original.nickname }})</span>
            </div>
          </template>

          <template #emailVerification-cell="{ row }">
            <UBadge
              :color="row.original.emailVerifiedAt ? 'success' : 'warning'"
              variant="subtle"
              size="xs"
              class="cursor-pointer"
              @click="openUserDetail(Number(row.original.id))"
            >
              {{ row.original.emailVerifiedAt ? (isZh ? '已验证' : 'Verified') : (isZh ? '未验证' : 'Unverified') }}
            </UBadge>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-gray-500 dark:text-gray-400 font-mono">{{ formatDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                @click="openUserDetail(Number(row.original.id))"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                :disabled="row.original.username === 'admin' || !hasAdminPerm('customers:edit')"
                :title="row.original.username === 'admin' ? 'Use Profile page to edit admin' : ''"
                @click="openModal(row.original)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                :disabled="row.original.username === 'admin' || !hasAdminPerm('customers:edit')"
                :title="row.original.username === 'admin' ? 'Cannot delete main admin' : ''"
                @click="deleteUser(Number(row.original.id))"
              />
            </div>
          </template>
        </UTable>

        <!-- Empty State -->
        <div
          v-if="paginatedUsers.length === 0 && !usersPending"
          class="flex flex-col items-center justify-center py-16 text-center px-4"
        >
          <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
            <UIcon
              name="ph:user-circle"
              class="w-6 h-6"
            />
          </div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ searchKeyword ? $t('admin.customers.no_customers_found') : $t('admin.common.noData') }}
          </p>
          <UButton
            v-if="searchKeyword"
            color="primary"
            variant="soft"
            size="xs"
            class="mt-3"
            icon="ph:arrow-counter-clockwise"
            @click="searchInput = ''; searchKeyword = ''"
          >
            {{ $t('admin.customers.clear_search') }}
          </UButton>
        </div>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-gray-200/80 dark:border-gray-800/60 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.common.showing') }} <span class="text-gray-900 dark:text-white font-medium">{{ usersTotalItems > 0 ? Math.min(usersTotalItems, (usersPage - 1) * usersPageCount + 1) : 0 }}</span> {{ $t('admin.common.to') }} <span class="text-gray-900 dark:text-white font-medium">{{ Math.min(usersPage * usersPageCount, usersTotalItems) }}</span> {{ $t('admin.common.of') }} <span class="text-gray-900 dark:text-white font-medium">{{ usersTotalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="usersPage"
          :total="usersTotalItems"
          :items-per-page="usersPageCount"
          @update:page="(val) => onUsersPageChange(val, () => usersRefresh())"
        />
      </div>
    </div>

    <!-- User Modal -->
    <UModal
      v-model:open="isModalOpen"
      :title="form.id ? $t('admin.users.edit') : $t('admin.users.add')"
    >
      <template #content>
        <form
          class="space-y-4 p-4"
          @submit.prevent="saveUser"
        >
          <UFormField
            :label="$t('admin.users.username')"
            required
          >
            <UInput
              v-model="form.username"
              required
              :disabled="!!form.id"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="$t('auth.password')"
            :required="!form.id"
          >
            <UInput
              v-model="form.password"
              type="password"
              :required="!form.id"
              :placeholder="form.id ? $t('admin.users.leave_blank_password') : ''"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="$t('admin.users.role')"
            required
          >
            <USelect
              v-model="form.role"
              :items="roles"
              required
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-4">
            <UButton
              color="neutral"
              variant="ghost"
              @click="isModalOpen = false"
            >{{ $t('admin.users.cancel') }}</UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSaving"
            >{{ $t('admin.users.save') }}</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Detail Modals -->
    <AdminCustomerDetailModal
      v-model="isCustomerDetailOpen"
      :email="customerDetailEmail"
      :visitor-id="customerDetailVisitorId"
      @view-user="handleViewRegisteredUser"
    />

    <AdminUserDetailModal
      v-model="isUserDetailOpen"
      :user-id="userDetailId"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { definePageMeta, useToast, useFetch, useRouter, useI18n } from '#imports'
import AdminCustomerDetailModal from '~/components/admin/customers/CustomerDetailModal.vue'
import AdminUserDetailModal from '~/components/admin/customers/UserDetailModal.vue'

const { t, locale } = useI18n()
const isZh = computed(() => (locale.value || '').startsWith('zh'))
const { formatDateTime } = useFormatTime()
const { formatCurrencyTotals } = useCurrencyFormat()

definePageMeta({ title: 'Customers & Users', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const activeTab = ref('users')

const tabs = computed(() => [
  {
    label: t('admin.users.registered'),
    value: 'users',
    icon: 'ph:user-circle',
  },
  { label: t('admin.customers.title'), value: 'customers', icon: 'ph:users' },
])

const columns = computed(() => [
  { accessorKey: 'email', header: t('admin.customers.email') },
  { accessorKey: 'visitorId', header: t('admin.customers.visitorId') },
  { accessorKey: 'totalSpent', header: t('admin.customers.totalSpent') },
  { accessorKey: 'totalOrders', header: t('admin.customers.orders') },
  { accessorKey: 'lastOrderAt', header: t('admin.customers.lastActive') },
  { accessorKey: 'actions', header: t('admin.users.actions') },
])

// Search & Pagination
const searchInput = ref('')
const searchKeyword = ref('')

let searchDebounceTimer: any = null
watch(searchInput, (val) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchKeyword.value = (val || '').trim()
    page.value = 1
    usersPage.value = 1
  }, 350)
})

const { page, pageSize: pageCount, onPageChange } = usePagination(15)

const {
  data: customersData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/customers', {
  query: computed(() => ({
    page: page.value,
    pageSize: pageCount.value,
    search: searchKeyword.value || undefined,
  })),
  watch: [page, searchKeyword],
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

// --- Detail modals ---

const isCustomerDetailOpen = ref(false)
const customerDetailEmail = ref<string | null>(null)
const customerDetailVisitorId = ref<string | null>(null)

const openCustomerDetail = (row: any) => {
  customerDetailEmail.value = row.email
  customerDetailVisitorId.value = row.visitorId || null
  isCustomerDetailOpen.value = true
}

const isUserDetailOpen = ref(false)
const userDetailId = ref<number | null>(null)

const openUserDetail = (id: number) => {
  userDetailId.value = id
  isUserDetailOpen.value = true
}

// Jump from a customer's order history straight to their registered account.
const handleViewRegisteredUser = (id: number) => {
  isCustomerDetailOpen.value = false
  openUserDetail(id)
}

// --- Users (Registered) Logic ---

const userColumns = computed(() => [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'username', header: t('admin.users.username') },
  { accessorKey: 'emailVerification', header: isZh.value ? '邮箱验证' : 'Email Verification' },
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
  query: computed(() => ({
    page: usersPage.value,
    pageSize: usersPageCount.value,
    search: searchKeyword.value || undefined,
  })),
  watch: [usersPage, searchKeyword],
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
  role: 'admin',
})

const roles = [
  { label: 'Admin', value: 'admin' },
  { label: 'Super Admin', value: 'superadmin' },
]

const openModal = (user?: any) => {
  if (user) {
    form.id = user.id
    form.username = user.username
    form.password = ''
    form.role = user.role || 'admin'
  } else {
    form.id = null
    form.username = ''
    form.password = ''
    form.role = 'admin'
  }
  isModalOpen.value = true
}

const saveUser = async () => {
  isSaving.value = true
  try {
    if (form.id) {
      await $fetch(`/api/admin/users/${form.id}`, {
        method: 'PUT',
        body: {
          password: form.password || undefined,
          role: form.role,
        },
      })
      toast.add({ title: 'Success', description: 'User updated successfully', color: 'success' })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: form,
      })
      toast.add({ title: 'Success', description: 'User created successfully', color: 'success' })
    }
    isModalOpen.value = false
    usersRefresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to save user', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

const deleteUser = async (id: number) => {
  if (!await confirm({
    title: t('admin.users.delete'),
    message: t('admin.users.confirmDelete'),
  })) return

  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'User deleted successfully', color: 'success' })
    usersRefresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to delete user', color: 'error' })
  }
}
</script>
