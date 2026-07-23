<template>
  <div class="min-h-[calc(100vh-10rem)] flex flex-col gap-6 pb-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.promo.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.promo.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          color="neutral"
          variant="soft"
          :loading="initializingTiers"
          @click="initDefaultTiers"
        >
          {{ $t('admin.promo.initDefaultTiers') }}
        </UButton>
        <UInput
          v-model="settingsForm.promoInviteRewardAmount"
          type="number"
          min="0"
          step="0.01"
          class="w-48"
          :placeholder="$t('admin.promo.rewardPlaceholder')"
        />
        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white"
          :loading="savingSettings"
          @click="saveSettings"
        >
          {{ $t('admin.promo.saveSettings') }}
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 shrink-0">
      <div
        v-for="card in overviewCards"
        :key="card.label"
        class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5"
      >
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</div>
        <div class="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{{ card.value }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-0">
      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-[24rem] max-h-[32rem] overflow-hidden">
        <div class="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.tiersTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.tiersSubtitle') }}</p>
          </div>
          <UButton color="primary" variant="soft" icon="ph:plus-bold" @click="openTierModal()">
            {{ $t('admin.promo.addTier') }}
          </UButton>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="tierColumns" :data="tiers" :loading="tiersPending" sticky>
            <template #discountRate-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">{{ formatDiscount(row.original.discountRate) }}</span>
            </template>
            <template #salesThreshold-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">${{ Number(row.original.salesThreshold || 0).toFixed(2) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <UButton color="neutral" variant="ghost" icon="ph:pencil-simple" @click="openTierModal(row.original)" />
            </template>
          </UTable>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.agentsTitle') }}</h2>
          <UButton color="primary" variant="soft" icon="ph:user-plus" @click="agentModalOpen = true">
            {{ $t('admin.promo.addAgent') }}
          </UButton>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 shrink-0">{{ $t('admin.promo.agentsSubtitle') }}</p>
        <div class="flex-1 overflow-auto mt-4">
          <UTable :columns="agentColumns" :data="agents" :loading="agentsPending" sticky>
            <template #role-cell="{ row }">
              <UBadge :color="row.original.role === 'master_agent' ? 'warning' : 'primary'" variant="subtle">
                {{ row.original.role === 'master_agent' ? $t('admin.promo.masterAgent') : $t('admin.promo.agent') }}
              </UBadge>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.relationsTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.relationsSubtitle') }}</p>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="relationColumns" :data="relations" :loading="relationsPending" sticky>
            <template #agentUserId-cell="{ row }">
              <div class="flex flex-col">
                <span class="text-sm text-gray-900 dark:text-white">#{{ row.original.agentUserId }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ row.original.agentNickname || row.original.agentEmail || '-' }}</span>
              </div>
            </template>
            <template #parentAgentUserId-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ row.original.parentAgentUserId || '-' }}</span>
            </template>
            <template #masterAgentUserId-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">{{ row.original.masterAgentUserId || '-' }}</span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex items-center gap-1">
                <UButton color="neutral" variant="ghost" icon="ph:arrows-clockwise" @click="openRelationModal(row.original)" />
                <UButton color="error" variant="ghost" icon="ph:trash" @click="openRelationDeleteModal(row.original)" />
              </div>
            </template>
          </UTable>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.teamReportTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.teamReportSubtitle') }}</p>
          </div>
          <USelect v-model.number="selectedMasterAgentUserId" :items="masterAgentOptions" class="w-72" />
        </div>
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4 shrink-0">
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.promo.teamCount') }}</div>
            <div class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ teamReport?.summary?.teamCount || 0 }}</div>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.promo.teamPaidOrders') }}</div>
            <div class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ teamReport?.summary?.paidOrderCount || 0 }}</div>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.promo.teamSalesAmount') }}</div>
            <div class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">${{ Number(teamReport?.summary?.totalSalesAmount || 0).toFixed(2) }}</div>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.promo.teamCommissionAmount') }}</div>
            <div class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">${{ Number(teamReport?.summary?.totalCommissionAmount || 0).toFixed(2) }}</div>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="teamReportColumns" :data="teamReport?.rows || []" :loading="teamReportPending" sticky>
            <template #totalSalesAmount-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">${{ Number(row.original.totalSalesAmount || 0).toFixed(2) }}</span>
            </template>
            <template #totalCommissionAmount-cell="{ row }">
              <span class="text-sm text-emerald-600 dark:text-emerald-400">${{ Number(row.original.totalCommissionAmount || 0).toFixed(2) }}</span>
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.commissionsTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.commissionsSubtitle') }}</p>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="commissionColumns" :data="commissions" :loading="overviewPending" sticky>
            <template #amount-cell="{ row }">
              <span class="font-medium text-emerald-600 dark:text-emerald-400">${{ Number(row.original.amount || 0).toFixed(2) }}</span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-1 gap-6 flex-1 min-h-0">
      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.teamOrdersTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.teamOrdersSubtitle') }}</p>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="teamOrderColumns" :data="teamOrders || []" :loading="teamOrdersPending" sticky>
            <template #amount-cell="{ row }">
              <span class="font-medium text-gray-900 dark:text-white">${{ Number(row.original.amount || 0).toFixed(2) }}</span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/50 rounded-2xl p-5 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.attributionsTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.attributionsSubtitle') }}</p>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="attributionColumns" :data="attributions" :loading="overviewPending" sticky>
            <template #discountRateSnapshot-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">{{ formatDiscount(row.original.discountRateSnapshot) }}</span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <UModal v-model:open="agentModalOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.addAgent') }}</h3>

          <UFormField :label="$t('admin.promo.agentEmail')">
            <UInput v-model="agentForm.email" type="email" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="$t('admin.promo.agentRole')">
              <USelect v-model="agentForm.role" :items="roleScopeOptions" />
            </UFormField>
            <UFormField :label="$t('admin.promo.parentMasterAgent')">
              <USelect
                v-model.number="agentForm.parentAgentUserId"
                :items="masterAgentOptions"
                :disabled="agentForm.role === 'master_agent'"
              />
            </UFormField>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="agentModalOpen = false">{{ $t('admin.common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingAgent" @click="saveAgent">{{ $t('admin.common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="relationModalOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.editRelation') }}</h3>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
            {{ relationForm.agentLabel || '-' }}
          </div>
          <UFormField :label="$t('admin.promo.parentMasterAgent')">
            <USelect v-model.number="relationForm.parentAgentUserId" :items="masterAgentOptions" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="relationModalOpen = false">{{ $t('admin.common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingRelation" @click="saveRelation">{{ $t('admin.common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteRelationModalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
              <UIcon name="ph:warning-circle-fill" class="w-5 h-5" />
            </div>
            <div class="space-y-1">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.deleteRelationTitle') }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.promo.deleteRelationDescription') }}</p>
            </div>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
            {{ relationDeleteTarget?.agentNickname || relationDeleteTarget?.agentEmail || relationDeleteTarget?.agentUserId || '-' }}
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="deleteRelationModalOpen = false">{{ $t('admin.common.cancel') }}</UButton>
            <UButton color="error" :loading="deletingRelation" @click="deleteRelation">{{ $t('admin.common.delete') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="tierModalOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ tierForm.id ? $t('admin.promo.editTier') : $t('admin.promo.addTier') }}
          </h3>

          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="$t('admin.promo.tierCode')">
              <UInput v-model="tierForm.code" />
            </UFormField>
            <UFormField :label="$t('admin.promo.tierName')">
              <UInput v-model="tierForm.name" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="$t('admin.promo.roleScope')">
              <USelect v-model="tierForm.roleScope" :items="roleScopeOptions" />
            </UFormField>
            <UFormField :label="$t('admin.promo.level')">
              <UInput v-model.number="tierForm.level" type="number" min="1" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="$t('admin.promo.discountRate')">
              <UInput v-model.number="tierForm.discountRate" type="number" min="0" max="1" step="0.01" />
            </UFormField>
            <UFormField :label="$t('admin.promo.salesThreshold')">
              <UInput v-model.number="tierForm.salesThreshold" type="number" min="0" step="0.01" />
            </UFormField>
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <USwitch v-model="tierForm.isFixed" />
              {{ $t('admin.promo.fixedTier') }}
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <USwitch v-model="tierForm.isActive" />
              {{ $t('admin.promo.activeTier') }}
            </label>
          </div>

          <UFormField :label="$t('admin.promo.description')">
            <UTextarea v-model="tierForm.description" :rows="3" />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="tierModalOpen = false">{{ $t('admin.common.cancel') }}</UButton>
            <UButton color="primary" :loading="savingTier" @click="saveTier">{{ $t('admin.common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

definePageMeta({ title: 'Promo Management' })

const { t } = useI18n()
const toast = useToast()
const { formatDateTime } = useFormatTime()

const { data: overviewData, pending: overviewPending, refresh: refreshOverview } = await useFetch<any>('/api/admin/promo/overview')
const { data: tiersData, pending: tiersPending, refresh: refreshTiers } = await useFetch<any[]>('/api/admin/promo/tiers')
const { data: agentsData, pending: agentsPending, refresh: refreshAgents } = await useFetch<any>('/api/admin/promo/agents', {
  query: { page: 1, pageSize: 50 },
})
const { data: relationsData, pending: relationsPending, refresh: refreshRelations } = await useFetch<any[]>('/api/admin/promo/relations')
const { data: settingsData, refresh: refreshSettings } = await useFetch<any>('/api/admin/promo/settings', {
  default: () => ({ promo_invite_reward_amount: '0' }),
})
const selectedMasterAgentUserId = ref<number | undefined>(undefined)
const teamReportQuery = computed(() => ({
  masterAgentUserId: selectedMasterAgentUserId.value || 0,
}))
const { data: teamReport, pending: teamReportPending, refresh: refreshTeamReport } = await useFetch<any>('/api/admin/promo/team-report', {
  query: teamReportQuery,
})
const { data: teamOrders, pending: teamOrdersPending, refresh: refreshTeamOrders } = await useFetch<any[]>('/api/admin/promo/team-orders', {
  query: teamReportQuery,
  default: () => [],
})

const settingsForm = reactive({
  promoInviteRewardAmount: '0',
})

watchEffect(() => {
  settingsForm.promoInviteRewardAmount = String(settingsData.value?.promo_invite_reward_amount || '0')
})

const overviewCards = computed(() => {
  const overview = overviewData.value?.overview || {}
  return [
    { label: t('admin.promo.overviewMembers'), value: overview.members || 0 },
    { label: t('admin.promo.overviewAgents'), value: overview.agents || 0 },
    { label: t('admin.promo.overviewMasterAgents'), value: overview.masterAgents || 0 },
    { label: t('admin.promo.overviewOrders'), value: overview.attributedOrders || 0 },
    { label: t('admin.promo.overviewCommission'), value: `$${Number(overview.commissionAmount || 0).toFixed(2)}` },
  ]
})

const tiers = computed(() => tiersData.value || [])
const agents = computed(() => agentsData.value?.data || overviewData.value?.agents || [])
const relations = computed(() => relationsData.value || [])
const commissions = computed(() => overviewData.value?.commissions || [])
const attributions = computed(() => overviewData.value?.attributions || [])
const masterAgentOptions = computed(() => {
  const rows = (agents.value || []).filter((item: any) => item.role === 'master_agent')
  return rows.map((item: any) => ({
    label: `${item.nickname || item.email} (#${item.userId})`,
    value: item.userId,
  }))
})

watchEffect(() => {
  if (!selectedMasterAgentUserId.value && masterAgentOptions.value.length > 0) {
    selectedMasterAgentUserId.value = masterAgentOptions.value[0]?.value
  }
})

const tierColumns = computed(() => [
  { accessorKey: 'code', header: t('admin.promo.tierCode') },
  { accessorKey: 'name', header: t('admin.promo.tierName') },
  { accessorKey: 'roleScope', header: t('admin.promo.roleScope') },
  { accessorKey: 'discountRate', header: t('admin.promo.discountRate') },
  { accessorKey: 'salesThreshold', header: t('admin.promo.salesThreshold') },
  { accessorKey: 'actions', header: t('admin.common.actions') },
])

const agentColumns = computed(() => [
  { accessorKey: 'email', header: t('admin.promo.agentEmail') },
  { accessorKey: 'nickname', header: t('admin.promo.agentNickname') },
  { accessorKey: 'role', header: t('admin.promo.agentRole') },
  { accessorKey: 'promoCode', header: t('admin.promo.agentPromoCode') },
  { accessorKey: 'agentCode', header: t('admin.promo.agentCode') },
  { accessorKey: 'createdAt', header: t('admin.promo.createdAt') },
])

const relationColumns = computed(() => [
  { accessorKey: 'agentUserId', header: t('admin.promo.agentUserId') },
  { accessorKey: 'parentAgentUserId', header: t('admin.promo.parentAgentUserId') },
  { accessorKey: 'masterAgentUserId', header: t('admin.promo.masterAgentUserId') },
  { accessorKey: 'depth', header: t('admin.promo.depth') },
  { accessorKey: 'createdAt', header: t('admin.promo.createdAt') },
  { accessorKey: 'actions', header: t('admin.common.actions') },
])

const commissionColumns = computed(() => [
  { accessorKey: 'orderId', header: t('admin.promo.orderId') },
  { accessorKey: 'type', header: t('admin.promo.commissionType') },
  { accessorKey: 'amount', header: t('admin.promo.commissionAmount') },
  { accessorKey: 'status', header: t('admin.promo.commissionStatus') },
  { accessorKey: 'createdAt', header: t('admin.promo.createdAt') },
])

const teamReportColumns = computed(() => [
  { accessorKey: 'email', header: t('admin.promo.agentEmail') },
  { accessorKey: 'nickname', header: t('admin.promo.agentNickname') },
  { accessorKey: 'paidOrderCount', header: t('admin.promo.teamPaidOrders') },
  { accessorKey: 'totalSalesAmount', header: t('admin.promo.teamSalesAmount') },
  { accessorKey: 'totalCommissionAmount', header: t('admin.promo.teamCommissionAmount') },
])

const teamOrderColumns = computed(() => [
  { accessorKey: 'orderId', header: t('admin.promo.orderId') },
  { accessorKey: 'agentEmail', header: t('admin.promo.agentEmail') },
  { accessorKey: 'buyerEmail', header: t('admin.promo.buyerEmail') },
  { accessorKey: 'amount', header: t('admin.promo.amount') },
  { accessorKey: 'payStatus', header: t('admin.promo.payStatus') },
  { accessorKey: 'orderStatus', header: t('admin.promo.orderStatus') },
  { accessorKey: 'createdAt', header: t('admin.promo.createdAt') },
])

const attributionColumns = computed(() => [
  { accessorKey: 'orderId', header: t('admin.promo.orderId') },
  { accessorKey: 'sourceType', header: t('admin.promo.sourceType') },
  { accessorKey: 'agentTierNameSnapshot', header: t('admin.promo.tierSnapshot') },
  { accessorKey: 'discountRateSnapshot', header: t('admin.promo.discountSnapshot') },
  { accessorKey: 'createdAt', header: t('admin.promo.createdAt') },
])

const roleScopeOptions = [
  { label: t('admin.promo.agent'), value: 'agent' },
  { label: t('admin.promo.masterAgent'), value: 'master_agent' },
]

const tierModalOpen = ref(false)
const agentModalOpen = ref(false)
const relationModalOpen = ref(false)
const deleteRelationModalOpen = ref(false)
const savingTier = ref(false)
const savingSettings = ref(false)
const savingAgent = ref(false)
const savingRelation = ref(false)
const deletingRelation = ref(false)
const initializingTiers = ref(false)

const tierForm = reactive({
  id: 0,
  code: '',
  name: '',
  roleScope: 'agent',
  level: 1,
  discountRate: 1,
  salesThreshold: 0,
  isFixed: false,
  isActive: true,
  description: '',
})

const agentForm = reactive({
  email: '',
  role: 'agent',
  parentAgentUserId: 0,
})

const relationForm = reactive({
  relationId: 0,
  parentAgentUserId: 0,
  agentLabel: '',
})

const relationDeleteTarget = ref<any>(null)

function openTierModal(tier?: any) {
  Object.assign(tierForm, {
    id: tier?.id || 0,
    code: tier?.code || '',
    name: tier?.name || '',
    roleScope: tier?.roleScope || 'agent',
    level: Number(tier?.level || 1),
    discountRate: Number(tier?.discountRate || 1),
    salesThreshold: Number(tier?.salesThreshold || 0),
    isFixed: Boolean(tier?.isFixed),
    isActive: tier?.isActive !== false,
    description: tier?.description || '',
  })
  tierModalOpen.value = true
}

function formatDiscount(value: any) {
  const rate = Number(value || 0)
  if (!Number.isFinite(rate) || rate <= 0) return '-'
  return `${(rate * 100).toFixed(0)}%`
}

async function saveTier() {
  savingTier.value = true
  try {
    await $fetch('/api/admin/promo/tiers', {
      method: 'POST',
      body: { ...tierForm },
    })
    tierModalOpen.value = false
    await refreshTiers()
    toast.add({ title: t('admin.promo.saveSuccess'), color: 'success' })
  } catch (error: any) {
    toast.add({ title: error?.data?.statusMessage || t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    savingTier.value = false
  }
}

async function saveSettings() {
  savingSettings.value = true
  try {
    await $fetch('/api/admin/promo/settings', {
      method: 'POST',
      body: {
        promo_invite_reward_amount: settingsForm.promoInviteRewardAmount,
      },
    })
    await refreshSettings()
    await refreshOverview()
    toast.add({ title: t('admin.promo.saveSuccess'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    savingSettings.value = false
  }
}

async function saveAgent() {
  savingAgent.value = true
  try {
    await $fetch('/api/admin/promo/agents', {
      method: 'POST',
      body: {
        email: agentForm.email,
        role: agentForm.role,
        parentAgentUserId: agentForm.role === 'master_agent' ? null : agentForm.parentAgentUserId,
      },
    })
    agentModalOpen.value = false
    agentForm.email = ''
    agentForm.role = 'agent'
    agentForm.parentAgentUserId = 0
    await Promise.all([refreshAgents(), refreshRelations(), refreshOverview(), refreshTeamReport()])
    toast.add({ title: t('admin.promo.saveSuccess'), color: 'success' })
  } catch (error: any) {
    toast.add({ title: error?.data?.message || error?.data?.statusMessage || t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    savingAgent.value = false
  }
}

function openRelationModal(row: any) {
  relationForm.relationId = Number(row?.relationId || 0)
  relationForm.parentAgentUserId = Number(row?.masterAgentUserId || row?.parentAgentUserId || 0)
  relationForm.agentLabel = `${row?.agentNickname || row?.agentEmail || ''} (#${row?.agentUserId || '-'})`
  relationModalOpen.value = true
}

function openRelationDeleteModal(row: any) {
  relationDeleteTarget.value = row
  deleteRelationModalOpen.value = true
}

async function saveRelation() {
  savingRelation.value = true
  try {
    await $fetch(`/api/admin/promo/relations/${relationForm.relationId}`, {
      method: 'PUT',
      body: {
        parentAgentUserId: relationForm.parentAgentUserId,
      },
    })
    relationModalOpen.value = false
    await Promise.all([refreshRelations(), refreshAgents(), refreshTeamReport(), refreshTeamOrders()])
    toast.add({ title: t('admin.promo.saveSuccess'), color: 'success' })
  } catch (error: any) {
    toast.add({ title: error?.data?.message || error?.data?.statusMessage || t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    savingRelation.value = false
  }
}

async function deleteRelation() {
  deletingRelation.value = true
  try {
    await $fetch(`/api/admin/promo/relations/${relationDeleteTarget.value?.relationId}`, {
      method: 'DELETE',
    })
    deleteRelationModalOpen.value = false
    relationDeleteTarget.value = null
    await Promise.all([refreshRelations(), refreshAgents(), refreshOverview(), refreshTeamReport(), refreshTeamOrders()])
    toast.add({ title: t('admin.promo.deleteRelationSuccess'), color: 'success' })
  } catch (error: any) {
    toast.add({ title: error?.data?.message || error?.data?.statusMessage || t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    deletingRelation.value = false
  }
}

async function initDefaultTiers() {
  initializingTiers.value = true
  try {
    await $fetch('/api/admin/promo/init', { method: 'POST' })
    await refreshTiers()
    toast.add({ title: t('admin.promo.initTierSuccess'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    initializingTiers.value = false
  }
}
</script>
