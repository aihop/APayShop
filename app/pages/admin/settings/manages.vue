<template>
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
        v-if="hasAdminPerm('admins')"
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
        <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-18rem)]">
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

              <template #permissions-cell="{ row }">
                <div class="flex flex-col gap-1.5">
                  <div v-if="row.original.permissionSummary?.all" class="flex items-center gap-1.5">
                    <UIcon name="ph:shield-check" class="w-4 h-4 text-emerald-500 shrink-0" />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ fullAccessLabel }}</span>
                  </div>
                  <div v-else class="flex items-center gap-1.5">
                    <UIcon name="ph:shield-half-tilt" class="w-4 h-4 text-blue-500 shrink-0" />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ row.original.permissionSummary?.count || 0 }} / {{ totalPermissionCount }} {{ permissionsLabel }}</span>
                  </div>
                  <div v-if="row.original.username === 'admin'" class="text-xs text-purple-500 dark:text-purple-400 font-medium">{{ superAdminLabel }}</div>
                </div>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="ph:pencil-simple"
                    @click="openModal(row.original)"
                    :disabled="!canEdit(row.original)"
                    :title="!canEdit(row.original) ? (row.original.username === 'admin' ? editBlockedTitle : noPermTitle) : ''"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="ph:trash"
                    @click="deleteUser(Number(row.original.id))"
                    :disabled="!canDelete(row.original)"
                    :title="!canDelete(row.original) ? (row.original.username === 'admin' ? deleteBlockedTitle : noPermTitle) : ''"
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
            class="space-y-5"
          >
            <UFormField :label="$t('admin.users.username')">
              <UInput
                v-model="form.username"
                required
                class="text-gray-900 dark:text-white w-full"
                :disabled="isEditingMainAdmin"
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

            <div>
              <div class="flex items-center justify-between mb-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ permissionSectionLabel }}</label>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ permissionSectionHint }}</p>
                </div>
                <div v-if="!isEditingMainAdmin" class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="toggleAllPerms(true)"
                  >{{ selectAllLabel }}</UButton>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="toggleAllPerms(false)"
                  >{{ clearAllLabel }}</UButton>
                </div>
              </div>

              <div
                v-if="isEditingMainAdmin"
                class="rounded-xl border border-purple-200/60 bg-purple-50/60 px-4 py-3 dark:border-purple-500/20 dark:bg-purple-500/10"
              >
                <div class="flex items-start gap-2.5">
                  <UIcon name="ph:shield-check" class="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <div class="text-sm font-medium text-purple-800 dark:text-purple-300">{{ superAdminLabel }}</div>
                    <div class="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">{{ superAdminHint }}</div>
                  </div>
                </div>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  v-for="def in ADMIN_PERMISSIONS"
                  :key="def.code"
                  class="flex items-start gap-2.5 rounded-lg border border-gray-200 dark:border-white/5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] has-[:checked]:border-purple-300 has-[:checked]:bg-purple-50/60 dark:has-[:checked]:border-purple-500/30 dark:has-[:checked]:bg-purple-500/10"
                >
                  <input
                    :checked="formPermissions.includes(def.code)"
                    :disabled="isEditingMainAdmin"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-[#1a1a1e] dark:ring-offset-0"
                    @change="onPermToggle(def.code, ($event.target as HTMLInputElement).checked)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ labelFor(def) }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ def.code }}</div>
                  </div>
                </label>
              </div>
            </div>

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
                :disabled="!hasAdminPerm('admins')"
              >{{ $t('admin.common.save') }}</UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { definePageMeta, useI18n, useToast, useConfirm, useFetch, useRouter, navigateTo } from '#imports'
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'
import { ADMIN_PERMISSIONS, useAdminPermissions, type AdminPermissionDef } from '~/composables/useAdminPermissions'

const { t, locale } = useI18n()
const { formatDateTime } = useFormatTime()

definePageMeta({ title: 'Users Management', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()

const { loadAdmin, hasPerm: hasAdminPerm, labelFor, permissions: currentAdminPerms, isSuper } = useAdminPermissions()

onMounted(async () => {
  await loadAdmin()
})

const goToSettingsTab = (tabId: string) => {
  if (isSettingsTabId(tabId)) {
    navigateTo({ path: '/admin/settings', query: { tab: tabId } })
  }
}

const totalPermissionCount = ADMIN_PERMISSIONS.length

const fullAccessLabel = computed(() => (locale.value.startsWith('zh') ? '全部权限' : 'Full Access'))
const permissionsLabel = computed(() => (locale.value.startsWith('zh') ? '个模块' : 'modules'))
const superAdminLabel = computed(() => (locale.value.startsWith('zh') ? '超级管理员' : 'Super Admin'))
const superAdminHint = computed(() => (locale.value.startsWith('zh') ? '主管理员账号默认拥有全部权限，不可修改或删除。' : 'The primary admin always has full access and cannot be modified or deleted.'))
const permissionSectionLabel = computed(() => (locale.value.startsWith('zh') ? '管理权限' : 'Permissions'))
const permissionSectionHint = computed(() => (locale.value.startsWith('zh') ? '勾选此管理员可访问的后台模块。' : 'Select which admin modules this account can access.'))
const selectAllLabel = computed(() => (locale.value.startsWith('zh') ? '全选' : 'Select All'))
const clearAllLabel = computed(() => (locale.value.startsWith('zh') ? '清空' : 'Clear All'))
const editBlockedTitle = computed(() => (locale.value.startsWith('zh') ? '超级管理员不可编辑，请到个人资料页修改密码' : 'Super admin is locked; use Profile page to change password'))
const deleteBlockedTitle = computed(() => (locale.value.startsWith('zh') ? '超级管理员不可删除' : 'Super admin cannot be deleted'))
const noPermTitle = computed(() => (locale.value.startsWith('zh') ? '无管理员管理权限' : 'Requires admins permission'))

const columns = computed(() => [
  { accessorKey: 'id', header: 'ID', size: 60 },
  { accessorKey: 'username', header: t('admin.users.username') },
  { accessorKey: 'permissions', header: permissionSectionLabel.value },
  { accessorKey: 'createdAt', header: t('admin.users.createdAt') },
  { accessorKey: 'actions', header: t('admin.users.actions'), size: 120 },
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

const formPermissions = ref<string[]>([])

const isEditingMainAdmin = computed(() => !!form.id && form.username === 'admin')

const canEdit = (row: any) => {
  if (!hasAdminPerm('admins')) return false
  if (row.username === 'admin') return isSuper.value
  return true
}

const canDelete = (row: any) => {
  if (!hasAdminPerm('admins')) return false
  if (row.username === 'admin') return false
  return true
}

const onPermToggle = (code: string, checked: boolean) => {
  if (checked) {
    if (!formPermissions.value.includes(code)) formPermissions.value.push(code)
  } else {
    const i = formPermissions.value.indexOf(code)
    if (i >= 0) formPermissions.value.splice(i, 1)
  }
}

const toggleAllPerms = (select: boolean) => {
  if (select) {
    formPermissions.value = ADMIN_PERMISSIONS.map(p => p.code)
  } else {
    formPermissions.value = []
  }
}

const openModal = (user?: any) => {
  if (user) {
    form.id = user.id
    form.username = user.username
    form.password = ''
    // null = legacy/unset row (full access); an explicit [] means the admin
    // was deliberately given zero permissions and must show as unchecked.
    const perms = Array.isArray(user.permissions) ? user.permissions : null
    if (perms === null || perms.includes('*')) {
      formPermissions.value = ADMIN_PERMISSIONS.map(p => p.code)
    } else {
      formPermissions.value = [...perms]
    }
  } else {
    form.id = null
    form.username = ''
    form.password = ''
    formPermissions.value = []
  }
  isModalOpen.value = true
}

const saveUser = async () => {
  if (!hasAdminPerm('admins')) {
    toast.add({ title: 'Error', description: noPermTitle.value, color: 'error' })
    return
  }
  isSaving.value = true
  try {
    const url = form.id ? `/api/admin/admins/${form.id}` : '/api/admin/admins'
    const method = form.id ? 'PUT' : 'POST'

    const payload: any = { username: form.username }
    if (form.password) {
      payload.password = form.password
    }

    if (!isEditingMainAdmin.value) {
      if (formPermissions.value.length >= ADMIN_PERMISSIONS.length) {
        payload.permissions = ['*']
      } else if (formPermissions.value.length === 0) {
        payload.permissions = []
      } else {
        payload.permissions = [...formPermissions.value]
      }
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
  if (!hasAdminPerm('admins')) {
    toast.add({ title: 'Error', description: noPermTitle.value, color: 'error' })
    return
  }
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
