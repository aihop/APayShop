<template>
  <div class="h-[calc(100vh-7rem)] flex flex-col space-y-4">
    <!-- Header & Action Row -->
    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {{ activeTab === 'users' ? $t('admin.users.registered') : $t('admin.customers.title') }}
          </h1>
          <UBadge
            color="primary"
            variant="subtle"
            size="xs"
            class="font-mono font-medium"
          >
            {{ activeTab === 'users' ? usersTotalItems : totalItems }}
          </UBadge>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
          {{ $t('admin.customers.subtitle') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrow-clockwise"
          size="sm"
          :loading="activeTab === 'customers' ? pending : usersPending"
          class="rounded-xl"
          @click="activeTab === 'customers' ? refresh() : usersRefresh()"
        />

        <UButton
          v-if="activeTab === 'users' && hasAdminPerm('customers:edit')"
          color="primary"
          size="sm"
          icon="ph:plus-bold"
          class="bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-xs font-medium"
          @click="openModal()"
        >
          {{ $t('admin.users.add') }}
        </UButton>
      </div>
    </div>

    <!-- Overview Metric Cards (Compact Inline Style) -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
      <!-- Total Registered Users -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-all"
        :class="{ 'ring-1 ring-purple-500 border-purple-500': activeTab === 'users' && userFilter === 'all' }"
        @click="activeTab = 'users'; userFilter = 'all'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:user-circle-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.users.registered') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-gray-900 dark:text-white font-mono ml-2 shrink-0">{{ usersTotalItems }}</span>
      </div>

      <!-- Verified Users -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-all"
        :class="{ 'ring-1 ring-emerald-500 border-emerald-500': activeTab === 'users' && userFilter === 'verified' }"
        @click="activeTab = 'users'; userFilter = 'verified'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:seal-check-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ isZh ? '已验证会员' : 'Verified Users' }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono ml-2 shrink-0">{{ verifiedCount }}</span>
      </div>

      <!-- Customers / Order Buyers -->
      <div
        class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between cursor-pointer hover:border-blue-500/50 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-all"
        :class="{ 'ring-1 ring-blue-500 border-blue-500': activeTab === 'customers' }"
        @click="activeTab = 'customers'"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:shopping-bag-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ $t('admin.customers.title') }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-blue-600 dark:text-blue-400 font-mono ml-2 shrink-0">{{ totalItems }}</span>
      </div>

      <!-- Total Member Balance -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-xl px-3 py-2 shadow-2xs flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <UIcon name="ph:wallet-duotone" class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ isZh ? '会员总资产' : 'Member Balances' }}</div>
          </div>
        </div>
        <span class="text-base font-bold text-amber-600 dark:text-amber-400 font-mono ml-2 shrink-0">{{ totalUserBalanceFormatted }}</span>
      </div>
    </div>

    <!-- Main Card Container -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/70 dark:border-gray-800/60 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <!-- Toolbar: Tabs & Search/Filters -->
      <div class="p-3.5 border-b border-gray-200/70 dark:border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 dark:bg-[#18181b]/30">
        <!-- Tabs on Left -->
        <UTabs
          v-model="activeTab"
          :items="tabs"
          size="sm"
          class="w-full sm:w-auto"
        />

        <!-- Filters & Search on Right -->
        <div class="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
          <!-- Quick User Status Filter (only for users tab) -->
          <USelect
            v-if="activeTab === 'users'"
            v-model="userFilter"
            :items="userFilterOptions"
            size="sm"
            class="w-36"
            :ui="{ base: 'rounded-xl' }"
          />

          <!-- Search Input -->
          <div class="w-full sm:w-72">
            <UInput
              v-model="searchInput"
              icon="ph:magnifying-glass"
              :placeholder="activeTab === 'users' ? (isZh ? '搜索用户名、邮箱、ID...' : 'Search users...') : (isZh ? '搜索客户邮箱、访客ID...' : 'Search customers...')"
              size="sm"
              class="w-full text-xs"
              :ui="{ base: 'rounded-xl' }"
              clearable
            />
          </div>

          <!-- Clear Search -->
          <UButton
            v-if="searchKeyword || (activeTab === 'users' && userFilter !== 'all')"
            color="neutral"
            variant="subtle"
            size="sm"
            icon="ph:x"
            class="rounded-xl text-xs"
            @click="resetFilters"
          >
            {{ isZh ? '重置' : 'Reset' }}
          </UButton>
        </div>
      </div>

      <!-- Users Tab Content (Registered Users) -->
      <div
        v-if="activeTab === 'users'"
        class="flex-1 overflow-auto custom-scrollbar"
      >
        <UTable
          :data="filteredUsers"
          :columns="userColumns"
          :loading="usersPending"
          class="min-w-full"
          sticky
        >
          <!-- ID -->
          <template #id-cell="{ row }">
            <span class="font-mono text-xs text-gray-500">#{{ row.original.id }}</span>
          </template>

          <!-- 用户身份与邮箱 (Identity) -->
          <template #username-cell="{ row }">
            <div class="flex items-center gap-2.5 py-1">
              <div class="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 font-bold text-xs">
                {{ (row.original.nickname || row.original.email || 'U').substring(0, 1).toUpperCase() }}
              </div>
              <div class="flex flex-col min-w-0 max-w-xs">
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer transition-colors"
                    @click="openUserDetail(Number(row.original.id))"
                  >
                    {{ row.original.nickname || row.original.email }}
                  </span>
                  <span
                    v-if="row.original.nickname && row.original.nickname !== row.original.email"
                    class="text-xs text-gray-400 truncate"
                  >
                    ({{ row.original.email }})
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span
                    class="text-[11px] text-gray-500 font-mono flex items-center gap-1 hover:text-purple-600 cursor-pointer"
                    @click.stop="copyText(row.original.email, '邮箱')"
                    title="点击复制邮箱"
                  >
                    <UIcon name="ph:envelope-simple" class="w-3 h-3" />
                    {{ row.original.email }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- 邮箱验证与账号状态 -->
          <template #emailVerification-cell="{ row }">
            <div class="flex items-center gap-1.5 flex-wrap">
              <UBadge
                :color="row.original.emailVerifiedAt ? 'success' : 'warning'"
                variant="subtle"
                size="xs"
                class="cursor-pointer font-medium"
                @click="openUserDetail(Number(row.original.id))"
              >
                <UIcon :name="row.original.emailVerifiedAt ? 'ph:check-circle' : 'ph:warning-circle'" class="w-3 h-3 mr-1" />
                {{ row.original.emailVerifiedAt ? (isZh ? '已验证' : 'Verified') : (isZh ? '未验证' : 'Unverified') }}
              </UBadge>
              <UBadge
                v-if="row.original.status !== undefined && row.original.status !== null"
                :color="row.original.status === 1 || row.original.status === 'active' ? 'neutral' : 'error'"
                variant="outline"
                size="xs"
              >
                {{ row.original.status === 1 || row.original.status === 'active' ? (isZh ? '正常' : 'Active') : (isZh ? '禁用' : 'Disabled') }}
              </UBadge>
            </div>
          </template>

          <!-- 资产与钱包余额 -->
          <template #balance-cell="{ row }">
            <div class="flex flex-col py-0.5">
              <div class="text-sm font-bold text-gray-900 dark:text-white font-mono">
                ¥{{ Number(row.original.availableBalance || 0).toFixed(2) }}
              </div>
              <div class="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                <span>现金: ¥{{ Number(row.original.cashBalance || 0).toFixed(2) }}</span>
                <span>赠送: ¥{{ Number(row.original.grantBalance || 0).toFixed(2) }}</span>
              </div>
            </div>
          </template>

          <!-- 消费与 API 活跃度 -->
          <template #spending-cell="{ row }">
            <div class="flex flex-col py-0.5">
              <span class="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                ¥{{ Number(row.original.totalSpend || 0).toFixed(2) }}
              </span>
              <span v-if="Number(row.original.activeKeyCount || 0) > 0" class="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                {{ row.original.activeKeyCount }} {{ isZh ? '个活跃 Key' : 'Keys' }}
              </span>
              <span v-else class="text-[11px] text-gray-400 font-mono">
                0 Keys
              </span>
            </div>
          </template>

          <!-- 注册与活跃时间 -->
          <template #createdAt-cell="{ row }">
            <div class="flex flex-col text-xs font-mono">
              <span class="text-gray-700 dark:text-gray-300 font-medium">
                {{ formatDateTime(row.original.createdAt) }}
              </span>
              <span v-if="row.original.lastLoginAt" class="text-gray-400 dark:text-gray-500 text-[11px]">
                {{ isZh ? '最后登录: ' : 'Login: ' }}{{ formatDateTime(row.original.lastLoginAt) }}
              </span>
            </div>
          </template>

          <!-- 操作 -->
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                :title="isZh ? '查看详情与邮件记录' : 'View details'"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="openUserDetail(Number(row.original.id))"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:pencil-simple"
                size="sm"
                :disabled="row.original.username === 'admin' || !hasAdminPerm('customers:edit')"
                :title="row.original.username === 'admin' ? '请在个人中心修改超级管理员' : (isZh ? '编辑' : 'Edit')"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="openModal(row.original)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="ph:trash"
                size="sm"
                :disabled="row.original.username === 'admin' || !hasAdminPerm('customers:edit')"
                :title="row.original.username === 'admin' ? '禁止删除主管理员' : (isZh ? '删除' : 'Delete')"
                class="rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                @click="deleteUser(Number(row.original.id))"
              />
            </div>
          </template>

          <!-- 空状态 -->
          <template #empty>
            <div class="flex flex-col items-center justify-center py-16 text-center px-4">
              <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                <UIcon name="ph:user-circle" class="w-6 h-6" />
              </div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ searchKeyword ? $t('admin.customers.no_customers_found') : $t('admin.common.noData') }}
              </p>
              <UButton
                v-if="searchKeyword || userFilter !== 'all'"
                color="neutral"
                variant="soft"
                size="xs"
                class="mt-3 rounded-lg"
                icon="ph:x"
                @click="resetFilters"
              >
                {{ isZh ? '清除筛选' : 'Clear filters' }}
              </UButton>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Customers Tab Content (Buyers / Visitors) -->
      <div
        v-else
        class="flex-1 overflow-auto custom-scrollbar"
      >
        <UTable
          :data="paginatedCustomers"
          :columns="columns"
          :loading="pending"
          class="min-w-full"
          sticky
        >
          <!-- 客户邮箱 -->
          <template #email-cell="{ row }">
            <div class="flex items-center gap-2 py-1">
              <div class="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                <UIcon name="ph:user" class="w-3.5 h-3.5" />
              </div>
              <span :class="row.original.email === 'Anonymous' || row.original.email === '匿名访客' ? 'text-gray-500 italic text-xs' : 'text-gray-900 dark:text-white font-medium text-sm'">
                {{ row.original.email }}
              </span>
            </div>
          </template>

          <!-- 访客 ID -->
          <template #visitorId-cell="{ row }">
            <span
              v-if="row.original.visitorId"
              class="inline-flex items-center gap-1 text-xs text-gray-500 font-mono cursor-pointer hover:text-purple-600 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md transition-colors"
              :title="String(row.original.visitorId)"
              @click="copyText(String(row.original.visitorId), 'Visitor ID')"
            >
              <UIcon name="ph:copy" class="w-3 h-3" />
              {{ String(row.original.visitorId).substring(0, 10) }}...
            </span>
            <span
              v-else
              class="text-xs text-gray-400"
            >-</span>
          </template>

          <!-- 消费总额 -->
          <template #totalSpent-cell="{ row }">
            <span class="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm">
              {{ formatCurrencyTotals(row.original.totalSpentByCurrency) }}
            </span>
          </template>

          <!-- 订单数 -->
          <template #totalOrders-cell="{ row }">
            <div class="flex items-center gap-1.5 font-mono">
              <span class="font-bold text-gray-900 dark:text-white">{{ row.original.totalOrders }}</span>
              <span
                v-if="Number(row.original.unpaidOrders || 0) > 0"
                class="text-[11px] text-red-500 font-medium"
                :title="$t('admin.customers.failed')"
              >
                ({{ row.original.unpaidOrders }} {{ $t('admin.customers.failed') }})
              </span>
            </div>
          </template>

          <!-- 最后活跃 -->
          <template #lastOrderAt-cell="{ row }">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ formatDateTime(row.original.lastOrderAt) }}</span>
          </template>

          <!-- 操作 -->
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end">
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                :title="isZh ? '查看订单记录与客户画像' : 'View customer orders'"
                class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="openCustomerDetail(row.original)"
              />
            </div>
          </template>

          <!-- 空状态 -->
          <template #empty>
            <div class="flex flex-col items-center justify-center py-16 text-center px-4">
              <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                <UIcon name="ph:users" class="w-6 h-6" />
              </div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ searchKeyword ? $t('admin.customers.no_customers_found') : $t('admin.common.noData') }}
              </p>
              <UButton
                v-if="searchKeyword"
                color="primary"
                variant="soft"
                size="xs"
                class="mt-3 rounded-lg"
                icon="ph:x"
                @click="searchInput = ''; searchKeyword = ''"
              >
                {{ $t('admin.customers.clear_search') }}
              </UButton>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Footer -->
      <div class="p-3.5 border-t border-gray-200/70 dark:border-gray-800/60 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {{ $t('admin.common.showing') }}
          <span class="text-gray-900 dark:text-white font-medium">
            {{ activeTab === 'users' ? (usersTotalItems > 0 ? Math.min(usersTotalItems, (usersPage - 1) * usersPageCount + 1) : 0) : (totalItems > 0 ? Math.min(totalItems, (page - 1) * pageCount + 1) : 0) }}
          </span>
          {{ $t('admin.common.to') }}
          <span class="text-gray-900 dark:text-white font-medium">
            {{ activeTab === 'users' ? Math.min(usersPage * usersPageCount, usersTotalItems) : Math.min(page * pageCount, totalItems) }}
          </span>
          {{ $t('admin.common.of') }}
          <span class="text-gray-900 dark:text-white font-medium">
            {{ activeTab === 'users' ? usersTotalItems : totalItems }}
          </span>
          {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-if="activeTab === 'users'"
          v-model="usersPage"
          :total="usersTotalItems"
          :items-per-page="usersPageCount"
          :max="5"
          @update:page="(val) => onUsersPageChange(val, () => usersRefresh())"
        />
        <UPagination
          v-else
          v-model="page"
          :total="totalItems"
          :items-per-page="pageCount"
          :max="5"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- User Create / Edit Modal -->
    <UModal
      v-model:open="isModalOpen"
      :title="form.id ? $t('admin.users.edit') : $t('admin.users.add')"
    >
      <template #content>
        <form
          @submit.prevent="saveUser"
          class="space-y-4 p-4"
        >
          <UFormField
            :label="$t('admin.users.username')"
            required
          >
            <UInput
              v-model="form.username"
              :disabled="!!form.id"
              required
              class="w-full"
              placeholder="user@example.com"
            />
          </UFormField>

          <UFormField
            :label="$t('admin.users.password')"
            :required="!form.id"
            :hint="form.id ? $t('admin.users.passwordHint') : ''"
          >
            <UInput
              v-model="form.password"
              type="password"
              :required="!form.id"
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
const userFilter = ref('all') // 'all' | 'verified' | 'unverified' | 'has_spending'

const tabs = computed(() => [
  {
    label: t('admin.users.registered'),
    value: 'users',
    icon: 'ph:user-circle',
  },
  { label: t('admin.customers.title'), value: 'customers', icon: 'ph:users' },
])

const userFilterOptions = computed(() => [
  { label: isZh.value ? '全部会员' : 'All Users', value: 'all' },
  { label: isZh.value ? '已验证邮箱' : 'Verified Email', value: 'verified' },
  { label: isZh.value ? '未验证邮箱' : 'Unverified Email', value: 'unverified' },
  { label: isZh.value ? '有消费会员' : 'Has Spending', value: 'has_spending' },
])

// 复制通用文本
const copyText = (text: string, label: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({
    title: t('admin.common.success'),
    description: `${label} 已复制到剪贴板`,
    color: 'success',
  })
}

// Columns for Customers (Visitors / Buyers)
const columns = computed(() => [
  { accessorKey: 'email', header: t('admin.customers.email') },
  { accessorKey: 'visitorId', header: t('admin.customers.visitorId'), meta: { class: { th: 'w-40' } } },
  { accessorKey: 'totalSpent', header: t('admin.customers.totalSpent'), meta: { class: { th: 'w-36' } } },
  { accessorKey: 'totalOrders', header: t('admin.customers.orders'), meta: { class: { th: 'w-32' } } },
  { accessorKey: 'lastOrderAt', header: t('admin.customers.lastActive'), meta: { class: { th: 'w-44' } } },
  {
    accessorKey: 'actions',
    header: t('admin.users.actions'),
    meta: {
      class: {
        th: 'w-24 text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
      },
    },
  },
])

// Columns for Registered Users (Rich information)
const userColumns = computed(() => [
  { accessorKey: 'id', header: 'ID', meta: { class: { th: 'w-16 font-mono text-center', td: 'text-center font-mono text-xs' } } },
  { accessorKey: 'username', header: isZh.value ? '用户身份 / 邮箱' : 'User Identity / Email' },
  { accessorKey: 'emailVerification', header: isZh.value ? '认证状态' : 'Verification', meta: { class: { th: 'w-36' } } },
  { accessorKey: 'balance', header: isZh.value ? '钱包资产' : 'Wallet Balance', meta: { class: { th: 'w-36' } } },
  { accessorKey: 'spending', header: isZh.value ? '消费 / Key' : 'Spending & Keys', meta: { class: { th: 'w-32' } } },
  { accessorKey: 'createdAt', header: isZh.value ? '注册 / 活跃时间' : 'Registered / Active', meta: { class: { th: 'w-44' } } },
  {
    accessorKey: 'actions',
    header: t('admin.users.actions'),
    meta: {
      class: {
        th: 'w-28 text-right sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:to-[#121214]',
      },
    },
  },
])

// Search
const searchInput = ref('')
const searchKeyword = ref('')

let searchDebounceTimer: any = null
watch(searchInput, (val) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchKeyword.value = (val || '').trim()
    page.value = 1
    usersPage.value = 1
  }, 300)
})

const resetFilters = () => {
  searchInput.value = ''
  searchKeyword.value = ''
  userFilter.value = 'all'
  page.value = 1
  usersPage.value = 1
}

// Pagination
const { page, pageSize: pageCount, onPageChange } = usePagination(15)

// Customers Data Fetch
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

const paginatedCustomers = computed(() => customersData.value?.data || [])
const totalItems = computed(() => customersData.value?.total || 0)

// --- Users (Registered) Data Fetch ---
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
    hasSpending: userFilter.value === 'has_spending' ? 'true' : undefined,
  })),
  watch: [usersPage, searchKeyword, userFilter],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const usersTotalItems = computed(() => usersData.value?.total || 0)
const paginatedUsers = computed(() => usersData.value?.data || [])

// 客户端过滤（已验证 / 未验证）
const filteredUsers = computed(() => {
  const list = paginatedUsers.value
  if (userFilter.value === 'verified') {
    return list.filter((u: any) => Boolean(u.emailVerifiedAt))
  }
  if (userFilter.value === 'unverified') {
    return list.filter((u: any) => !u.emailVerifiedAt)
  }
  return list
})

// 概览统计指标计算
const verifiedCount = computed(() => {
  return paginatedUsers.value.filter((u: any) => Boolean(u.emailVerifiedAt)).length
})

const totalUserBalanceFormatted = computed(() => {
  const sum = paginatedUsers.value.reduce((acc: number, u: any) => acc + Number(u.availableBalance || 0), 0)
  return `¥${sum.toFixed(2)}`
})

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

const handleViewRegisteredUser = (id: number) => {
  isCustomerDetailOpen.value = false
  openUserDetail(id)
}

// --- User Create / Edit Form ---
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
      toast.add({ title: t('admin.common.success'), description: '用户更新成功', color: 'success' })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: form,
      })
      toast.add({ title: t('admin.common.success'), description: '用户创建成功', color: 'success' })
    }
    isModalOpen.value = false
    usersRefresh()
  } catch (e: any) {
    toast.add({ title: t('admin.common.error'), description: e.data?.message || '操作失败', color: 'error' })
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
    toast.add({ title: t('admin.common.success'), description: '用户删除成功', color: 'success' })
    usersRefresh()
  } catch (e: any) {
    toast.add({ title: t('admin.common.error'), description: e.data?.message || '删除失败', color: 'error' })
  }
}
</script>
