<template>
  <div class="max-w-5xl mx-auto pb-12">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
        <UIcon
          name="ph:key-fill"
          class="w-8 h-8 text-purple-500"
        />
        {{ titleLabel }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ subtitleLabel }}</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <AdminSettingsNav
        active="authorization"
        @select="goToSettingsTab"
      />

      <div class="lg:col-span-9 space-y-8">
        <!-- Section 1: Outbound integration (this server authenticating itself to external services) -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ outboundSectionLabel }}</h2>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ outboundSectionHint }}</p>
            </div>
            <UButton
              v-if="hasAdminPerm('settings:edit')"
              size="sm"
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              :loading="isSavingIntegration"
              @click="saveIntegrationForm"
            >{{ $t('admin.common.save') }}</UButton>
          </div>

          <div
            v-if="!hasAdminPerm('settings:view')"
            class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400"
          >
            {{ noSettingsPermTitle }}
          </div>
          <AdminSettingsIntegrationTab
            v-else
            :form="integrationForm"
          />
        </div>

        <!-- Section 2: Inbound system tokens (scripts/automation calling into this server) -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ inboundSectionLabel }}</h2>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ inboundSectionHint }}</p>
            </div>
            <UButton
              v-if="hasAdminPerm('admins:edit')"
              size="sm"
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              icon="ph:plus-bold"
              @click="openCreateModal"
            >{{ createTokenLabel }}</UButton>
          </div>

          <div
            v-if="!hasAdminPerm('admins:view')"
            class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400"
          >
            {{ noTokensPermTitle }}
          </div>

          <div
            v-else
            class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden"
          >
            <div
              v-if="tokensPending"
              class="p-6 space-y-4"
            >
              <div
                v-for="i in 2"
                :key="i"
                class="h-16 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"
              ></div>
            </div>

            <div
              v-else-if="tokens.length"
              class="overflow-auto"
            >
              <UTable
                :data="tokens"
                :columns="tokenColumns"
                class="min-w-full"
              >
                <template #status-cell="{ row }">
                  <UBadge
                    :color="statusColor(row.original)"
                    variant="subtle"
                    size="sm"
                  >{{ statusLabel(row.original) }}</UBadge>
                </template>

                <template #permissions-cell="{ row }">
                  <div class="flex items-center gap-1.5">
                    <UIcon
                      v-if="row.original.permissionSummary?.all"
                      name="ph:shield-check"
                      class="w-4 h-4 text-emerald-500 shrink-0"
                    />
                    <UIcon
                      v-else
                      name="ph:shield-half-tilt"
                      class="w-4 h-4 text-blue-500 shrink-0"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                      {{ row.original.permissionSummary?.all ? fullAccessLabel : `${row.original.permissionSummary?.count || 0} / ${totalPermissionCount} ${permissionsLabel}` }}
                    </span>
                  </div>
                </template>

                <template #creator-cell="{ row }">
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ row.original.adminUsername || '—' }}</span>
                </template>

                <template #createdAt-cell="{ row }">
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
                </template>

                <template #lastUsedAt-cell="{ row }">
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ row.original.lastUsedAt ? formatDateTime(row.original.lastUsedAt) : neverLabel }}</span>
                </template>

                <template #actions-cell="{ row }">
                  <UButton
                    v-if="!row.original.revoked"
                    color="error"
                    variant="ghost"
                    icon="ph:trash"
                    :disabled="!hasAdminPerm('admins:edit')"
                    @click="revokeToken(row.original)"
                  />
                </template>
              </UTable>
            </div>

            <div
              v-else
              class="flex flex-col items-center justify-center py-16 text-center px-6"
            >
              <div class="w-14 h-14 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <UIcon
                  name="ph:key"
                  class="w-7 h-7 text-gray-400"
                />
              </div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1">{{ emptyTitleLabel }}</h3>
              <p class="text-gray-500 dark:text-gray-400 max-w-sm mb-5 text-sm">{{ emptyDescLabel }}</p>
              <UButton
                v-if="hasAdminPerm('admins:edit')"
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white"
                @click="openCreateModal"
              >{{ createTokenLabel }}</UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create token modal -->
    <FullScreenModal
      v-model="isCreateModalOpen"
      :title="createTokenLabel"
      maxWidth="sm:max-w-2xl"
      :defaultFullscreen="false"
    >
      <form
        id="admin-token-form"
        @submit.prevent="createToken"
        class="space-y-5"
      >
        <UFormField :label="nameLabel">
          <UInput
            v-model="createForm.name"
            required
            :placeholder="namePlaceholder"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="expiresLabel">
          <USelect
            v-model="createForm.expiresInDays"
            :items="expiryOptions"
            class="w-full"
          />
        </UFormField>

        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{{ permissionSectionLabel }}</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ permissionSectionHint }}</p>
            </div>
            <div class="flex items-center gap-2">
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

          <div class="flex items-center gap-4 px-3 mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">
            <div class="flex-1">{{ moduleColumnLabel }}</div>
            <div class="w-14 text-center shrink-0">{{ viewLabel }}</div>
            <div class="w-14 text-center shrink-0">{{ editLabel }}</div>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="def in ADMIN_PERMISSIONS"
              :key="def.code"
              class="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-white/5 px-3 py-2"
            >
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ labelFor(def) }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ def.code }}</div>
              </div>
              <div class="w-14 flex justify-center shrink-0">
                <input
                  :checked="hasView(def.code)"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-[#1a1a1e] dark:ring-offset-0"
                  @change="onViewToggle(def.code, ($event.target as HTMLInputElement).checked)"
                />
              </div>
              <div class="w-14 flex justify-center shrink-0">
                <input
                  v-if="def.editable !== false"
                  :checked="hasEdit(def.code)"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-[#1a1a1e] dark:ring-offset-0"
                  @change="onEditToggle(def.code, ($event.target as HTMLInputElement).checked)"
                />
              </div>
            </div>
          </div>

          <template v-if="extensionPermissionDefs.length">
            <div class="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-500 mt-4 mb-2">{{ themeSectionTitle }}</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                v-for="def in extensionPermissionDefs"
                :key="def.code"
                class="flex items-start gap-2.5 rounded-lg border border-gray-200 dark:border-white/5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] has-[:checked]:border-purple-300 has-[:checked]:bg-purple-50/60 dark:has-[:checked]:border-purple-500/30 dark:has-[:checked]:bg-purple-500/10"
              >
                <input
                  :checked="formPermissions.includes(def.code)"
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
          </template>
        </div>
      </form>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="isCreateModalOpen = false"
        >{{ $t('admin.common.cancel') }}</UButton>
        <UButton
          type="submit"
          form="admin-token-form"
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white"
          :loading="isCreating"
          :disabled="!hasAdminPerm('admins:edit')"
        >{{ createTokenLabel }}</UButton>
      </template>
    </FullScreenModal>

    <!-- Reveal-once modal -->
    <UModal
      v-model:open="isRevealModalOpen"
      :ui="{ content: 'bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex items-start gap-3 mb-5">
            <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <UIcon
                name="ph:warning-fill"
                class="w-5 h-5"
              />
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ revealTitleLabel }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ revealDescLabel }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
            <code class="text-sm text-emerald-600 dark:text-emerald-400 font-mono break-all flex-1">{{ revealedToken }}</code>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:copy"
              size="sm"
              @click="copyRevealedToken"
            />
          </div>
          <div class="flex justify-end pt-6">
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              @click="isRevealModalOpen = false"
            >{{ doneLabel }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { definePageMeta, useI18n, useToast, useConfirm, useRouter, navigateTo } from '#imports'
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'
import { ADMIN_PERMISSIONS, useAdminPermissions, moduleViewCode, moduleEditCode } from '~/composables/useAdminPermissions'

const { locale } = useI18n()
const { formatDateTime } = useFormatTime()

definePageMeta({ title: 'Authorization', layout: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()

const { loadAdmin, hasPerm: hasAdminPerm, labelFor } = useAdminPermissions()
const { extensionPermissionDefs, themeSectionTitle } = useAdminExtensions()

const isZh = computed(() => locale.value.startsWith('zh'))

const titleLabel = computed(() => (isZh.value ? '授权' : 'Authorization'))
const subtitleLabel = computed(() => (isZh.value ? '管理本服务对外调用时携带的凭据，以及允许别人调用本服务接口的系统 Token。' : 'Manage the credentials this server presents to outbound services, and the system tokens that let others call into this server.'))
const outboundSectionLabel = computed(() => (isZh.value ? '对外集成' : 'Outbound integration'))
const outboundSectionHint = computed(() => (isZh.value ? '本服务调用 AI Gateway / Webhook 等外部服务时，自己携带的认证信息。' : 'Credentials this server presents when calling out to the AI Gateway, webhooks, and other external services.'))
const inboundSectionLabel = computed(() => (isZh.value ? '系统 Token' : 'System tokens'))
const inboundSectionHint = computed(() => (isZh.value ? '供脚本 / 自动化直接调用本服务后台接口，权限范围在创建时勾选，和账号登录走的是同一套服务端校验。' : 'For scripts and automation to call this server’s admin APIs directly. Scope is set at creation and enforced by the same server-side checks as a logged-in admin.'))
const noSettingsPermTitle = computed(() => (isZh.value ? '无设置管理权限' : 'Requires settings permission'))
const noTokensPermTitle = computed(() => (isZh.value ? '无管理员管理权限' : 'Requires admins permission'))
const createTokenLabel = computed(() => (isZh.value ? '新建系统 Token' : 'Create System Token'))
const fullAccessLabel = computed(() => (isZh.value ? '全部权限' : 'Full Access'))
const permissionsLabel = computed(() => (isZh.value ? '个模块' : 'modules'))
const neverLabel = computed(() => (isZh.value ? '从未' : 'Never'))
const emptyTitleLabel = computed(() => (isZh.value ? '还没有系统 Token' : 'No system tokens yet'))
const emptyDescLabel = computed(() => (isZh.value ? '创建一个 Token，脚本里带 Authorization: Bearer 头就能直接调用后台接口。' : 'Create a token to call admin APIs from your own scripts with an Authorization: Bearer header.'))
const nameLabel = computed(() => (isZh.value ? '名称' : 'Name'))
const namePlaceholder = computed(() => (isZh.value ? '例如：数据同步脚本' : 'e.g. Data sync script'))
const expiresLabel = computed(() => (isZh.value ? '过期时间' : 'Expires'))
const permissionSectionLabel = computed(() => (isZh.value ? '权限范围' : 'Permission scope'))
const permissionSectionHint = computed(() => (isZh.value ? '勾选此 Token 可访问的后台模块，以及是否允许修改——和账号权限走同一套接口校验，不是仅前端过滤。' : 'Select which admin modules this token can reach, and whether it can make changes — enforced by the same API-level checks as account permissions, not just UI filtering.'))
const moduleColumnLabel = computed(() => (isZh.value ? '模块' : 'Module'))
const viewLabel = computed(() => (isZh.value ? '查看' : 'View'))
const editLabel = computed(() => (isZh.value ? '编辑' : 'Edit'))
const selectAllLabel = computed(() => (isZh.value ? '全选' : 'Select All'))
const clearAllLabel = computed(() => (isZh.value ? '清空' : 'Clear All'))
const revealTitleLabel = computed(() => (isZh.value ? '保存好这个 Token' : 'Save this token'))
const revealDescLabel = computed(() => (isZh.value ? '现在复制它——出于安全考虑，关闭这个窗口后就再也看不到完整内容了。' : 'Copy it now — for security, you won’t be able to see the full value again after closing this.'))
const doneLabel = computed(() => (isZh.value ? '我已保存' : 'Done, I saved it'))

const goToSettingsTab = (tabId: string) => {
  if (isSettingsTabId(tabId)) {
    navigateTo({ path: '/admin/settings', query: { tab: tabId } })
  }
}

// ---- Section 1: outbound integration settings ----
// Deliberately NOT useSettings()/`/api/settings` — that's the public,
// unauthenticated endpoint and (as of this page) no longer even returns
// secret-looking keys like integration_token. This admin-only endpoint
// returns the raw rows.
const integrationForm = reactive({
  integration_token: '',
  ai_gateway_url: '',
  webhook_url: '',
})
const isSavingIntegration = ref(false)

const loadIntegrationForm = async () => {
  if (!hasAdminPerm('settings:view')) return
  try {
    const rows: any[] = await $fetch('/api/admin/settings')
    for (const row of rows) {
      if (row.key in integrationForm) {
        (integrationForm as any)[row.key] = row.value
      }
    }
  } catch { /* leave defaults */ }
}

const saveIntegrationForm = async () => {
  isSavingIntegration.value = true
  try {
    await $fetch('/api/admin/settings', { method: 'POST', body: { ...integrationForm } })
    toast.add({ title: isZh.value ? '已保存' : 'Saved', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || (isZh.value ? '保存失败' : 'Failed to save'),
      color: 'error',
    })
  } finally {
    isSavingIntegration.value = false
  }
}

// ---- Section 2: system tokens ----
const totalPermissionCount = ADMIN_PERMISSIONS.length
const allPermissionDefs = computed(() => [...ADMIN_PERMISSIONS, ...extensionPermissionDefs.value])
const allTieredCodes = computed(() =>
  allPermissionDefs.value.flatMap((def) => {
    if (def.editable === undefined) return [def.code]
    return def.editable === false ? [moduleViewCode(def.code)] : [moduleViewCode(def.code), moduleEditCode(def.code)]
  })
)

const tokenColumns = computed(() => [
  { accessorKey: 'name', header: nameLabel.value },
  { accessorKey: 'status', header: isZh.value ? '状态' : 'Status' },
  { accessorKey: 'permissions', header: permissionSectionLabel.value },
  { accessorKey: 'creator', header: isZh.value ? '创建者' : 'Created by' },
  { accessorKey: 'createdAt', header: isZh.value ? '创建于' : 'Created' },
  { accessorKey: 'lastUsedAt', header: isZh.value ? '最近使用' : 'Last used' },
  { accessorKey: 'actions', header: '', size: 60 },
])

const tokensData = ref<any>(null)
const tokensPending = ref(true)

const refreshTokens = async () => {
  if (!hasAdminPerm('admins:view')) { tokensPending.value = false; return }
  tokensPending.value = true
  try {
    tokensData.value = await $fetch('/api/admin/admins/tokens')
  } catch (e: any) {
    if (e?.status === 401 || e?.statusCode === 401) useRouter().push('/admin/login')
  } finally {
    tokensPending.value = false
  }
}

const tokens = computed(() => tokensData.value?.data || [])

const isExpired = (tok: any) => !!tok.expiresAt && new Date(tok.expiresAt).getTime() < Date.now()
const statusColor = (tok: any): any => {
  if (tok.revoked) return 'neutral'
  if (isExpired(tok)) return 'warning'
  return 'success'
}
const statusLabel = (tok: any) => {
  if (tok.revoked) return isZh.value ? '已吊销' : 'Revoked'
  if (isExpired(tok)) return isZh.value ? '已过期' : 'Expired'
  return isZh.value ? '有效' : 'Active'
}

const isCreateModalOpen = ref(false)
const isCreating = ref(false)
const createForm = reactive({
  name: '',
  expiresInDays: 'never',
})
const formPermissions = ref<string[]>([])

const expiryOptions = computed(() => [
  { label: isZh.value ? '永不过期' : 'Never expires', value: 'never' },
  { label: isZh.value ? '30 天' : '30 days', value: '30' },
  { label: isZh.value ? '90 天' : '90 days', value: '90' },
  { label: isZh.value ? '365 天' : '365 days', value: '365' },
])

const openCreateModal = () => {
  createForm.name = ''
  createForm.expiresInDays = 'never'
  formPermissions.value = []
  isCreateModalOpen.value = true
}

const hasView = (code: string) =>
  formPermissions.value.includes(code) ||
  formPermissions.value.includes(moduleViewCode(code)) ||
  formPermissions.value.includes(moduleEditCode(code))

const hasEdit = (code: string) =>
  formPermissions.value.includes(code) || formPermissions.value.includes(moduleEditCode(code))

const clearModuleGrant = (code: string) => {
  formPermissions.value = formPermissions.value.filter(p => p !== code)
}

const onViewToggle = (code: string, checked: boolean) => {
  clearModuleGrant(code)
  const viewCode = moduleViewCode(code)
  const editCode = moduleEditCode(code)
  if (checked) {
    if (!formPermissions.value.includes(viewCode)) formPermissions.value.push(viewCode)
  } else {
    formPermissions.value = formPermissions.value.filter(p => p !== viewCode && p !== editCode)
  }
}

const onEditToggle = (code: string, checked: boolean) => {
  clearModuleGrant(code)
  const viewCode = moduleViewCode(code)
  const editCode = moduleEditCode(code)
  if (checked) {
    if (!formPermissions.value.includes(editCode)) formPermissions.value.push(editCode)
    if (!formPermissions.value.includes(viewCode)) formPermissions.value.push(viewCode)
  } else {
    const i = formPermissions.value.indexOf(editCode)
    if (i >= 0) formPermissions.value.splice(i, 1)
  }
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
  formPermissions.value = select ? [...allTieredCodes.value] : []
}

const isRevealModalOpen = ref(false)
const revealedToken = ref('')

const createToken = async () => {
  if (!hasAdminPerm('admins:edit')) return
  isCreating.value = true
  try {
    const permissions = formPermissions.value.length >= allTieredCodes.value.length
      ? ['*']
      : [...formPermissions.value]

    const res: any = await $fetch('/api/admin/admins/tokens', {
      method: 'POST',
      body: {
        name: createForm.name,
        expiresInDays: createForm.expiresInDays === 'never' ? null : Number(createForm.expiresInDays),
        permissions,
      },
    })
    isCreateModalOpen.value = false
    revealedToken.value = res.token
    isRevealModalOpen.value = true
    await refreshTokens()
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || (isZh.value ? '创建失败' : 'Failed to create token'),
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

const copyRevealedToken = () => {
  if (!revealedToken.value) return
  navigator.clipboard.writeText(revealedToken.value)
  toast.add({ title: isZh.value ? '已复制' : 'Copied', color: 'success' })
}

const revokeToken = async (tok: any) => {
  const isConfirmed = await confirm({
    title: isZh.value ? '吊销 Token' : 'Revoke Token',
    description: isZh.value
      ? `确定要吊销「${tok.name || tok.id}」吗？用它签名的请求会立刻失效。`
      : `Revoke "${tok.name || tok.id}"? Any request signed with it will stop working immediately.`,
  })
  if (!isConfirmed) return

  try {
    await $fetch(`/api/admin/admins/tokens/${tok.id}`, { method: 'DELETE' })
    await refreshTokens()
    toast.add({ title: isZh.value ? '已吊销' : 'Revoked', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || (isZh.value ? '吊销失败' : 'Failed to revoke token'),
      color: 'error',
    })
  }
}

onMounted(async () => {
  await loadAdmin()
  await Promise.all([loadIntegrationForm(), refreshTokens()])
})
</script>
