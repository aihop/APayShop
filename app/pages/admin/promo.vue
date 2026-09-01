<template>
  <div class="min-h-[calc(100vh-7rem)] flex flex-col gap-6">
    <!-- 1. 页面标题 -->
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.promo.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.promo.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          v-if="activeTab === 'settings' && hasAdminPerm('promo:edit')"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="initializingTiers"
          @click="initDefaultTiers"
        >
          {{ $t('admin.promo.initDefaultTiers') }}
        </UButton>
        <UButton
          v-if="activeTab === 'promoters' && hasAdminPerm('promo:edit')"
          color="primary"
          icon="ph:user-plus-bold"
          @click="agentModalOpen = true"
        >
          {{ $t('admin.promo.addAgent') }}
        </UButton>
      </div>
    </div>

    <!-- 2. 顶部大盘核心指标 (5张卡片) -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 shrink-0">
      <div
        v-for="card in overviewCards"
        :key="card.label"
        class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-4 transition-all hover:border-purple-500/30"
      >
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</div>
        <div class="mt-2 text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{{ card.value }}</div>
      </div>
    </div>

    <!-- 3. 功能场景切换 Tab 导航 -->
    <div class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 shrink-0">
      <button
        v-for="tab in promoTabs"
        :key="tab.key"
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all relative"
        :class="activeTab === tab.key
          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold shadow-xs'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'"
        @click="activeTab = tab.key"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" />
        <span>{{ tab.label }}</span>
        <UBadge v-if="tab.badge" color="error" size="xs" variant="solid" class="rounded-full px-1.5 py-0.2 text-[10px]">
          {{ tab.badge }}
        </UBadge>
      </button>
    </div>

    <!-- 4. Tab 1: 推广员与代理管理 (核心主入口) -->
    <div v-if="activeTab === 'promoters'" class="space-y-6 flex-1 min-h-0 flex flex-col">
      <!-- 待审核申请提示条 (如有) -->
      <div v-if="pendingApplicationsCount > 0" class="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <UIcon name="ph:bell-ringing-bold" class="w-5 h-5" />
          </div>
          <div>
            <div class="text-sm font-bold text-amber-900 dark:text-amber-200">有 {{ pendingApplicationsCount }} 条推广合伙人申请待处理</div>
            <div class="text-xs text-amber-700 dark:text-amber-400">请及时审核用户提交的推广渠道与合作说明。</div>
          </div>
        </div>
        <UButton size="xs" color="warning" variant="solid" @click="activeTab = 'promoters'">查看并审核</UButton>
      </div>

      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col flex-1 min-h-0">
        <!-- 搜索与筛选工具栏 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.agentsTitle') }}</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ $t('admin.promo.agentsSubtitle') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <UInput
              v-model="agentSearchKeyword"
              placeholder="搜索邮箱 / 昵称 / 推广码 / ID"
              icon="ph:magnifying-glass"
              class="w-64"
            />
            <USelect
              v-model="agentRoleFilter"
              :items="agentRoleFilterOptions"
              class="w-36"
            />
            <UButton v-if="hasAdminPerm('promo:edit')" color="primary" icon="ph:user-plus" @click="agentModalOpen = true">
              {{ $t('admin.promo.addAgent') }}
            </UButton>
          </div>
        </div>

        <!-- 推广员列表表格 -->
        <div class="flex-1 overflow-auto">
          <UTable :columns="agentColumns" :data="filteredAgents" :loading="agentsPending" sticky>
            <template #email-cell="{ row }">
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ row.original.nickname || row.original.email }}</span>
                <span class="text-xs text-gray-400">ID: #{{ row.original.userId }} · {{ row.original.email }}</span>
              </div>
            </template>
            <template #role-cell="{ row }">
              <UBadge :color="row.original.role === 'master_agent' ? 'warning' : 'primary'" variant="subtle">
                {{ row.original.role === 'master_agent' ? $t('admin.promo.masterAgent') : $t('admin.promo.agent') }}
              </UBadge>
            </template>
            <template #promoCode-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">{{ row.original.promoCode || '-' }}</span>
                <UButton
                  v-if="row.original.promoCode"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="ph:copy"
                  @click="copyPromoText(row.original.promoCode)"
                />
              </div>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>

      <!-- 合伙人申请审核列表 -->
      <div class="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm dark:border-gray-800/50 dark:bg-[#121214]">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">合伙人申请审核列表</h3>
            <UBadge v-if="pendingApplicationsCount > 0" color="error" variant="subtle" size="xs">
              {{ pendingApplicationsCount }} 个待审核
            </UBadge>
          </div>
          <UButton color="neutral" variant="ghost" icon="ph:arrows-clockwise" :loading="applicationsPending" @click="refreshApplications" />
        </div>
        <div class="overflow-auto max-h-72">
          <UTable :columns="applicationColumns" :data="applications" :loading="applicationsPending" sticky>
            <template #userEmail-cell="{ row }">
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ row.original.userNickname || row.original.userEmail }}</span>
                <span class="text-xs text-gray-400">ID: #{{ row.original.userId }} · {{ row.original.userEmail }}</span>
              </div>
            </template>
            <template #status-cell="{ row }">
              <UBadge
                :color="row.original.status === 'approved' ? 'success' : row.original.status === 'rejected' ? 'error' : 'warning'"
                variant="subtle"
              >
                {{ row.original.status === 'approved' ? '已通过' : row.original.status === 'rejected' ? '已驳回' : '待审核' }}
              </UBadge>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <div v-if="row.original.status === 'pending'" class="flex items-center gap-1.5">
                <UButton size="xs" color="success" variant="soft" :disabled="!hasAdminPerm('promo:edit')" @click="openAuditModal(row.original, 'approve')">通过</UButton>
                <UButton size="xs" color="error" variant="soft" :disabled="!hasAdminPerm('promo:edit')" @click="openAuditModal(row.original, 'reject')">驳回</UButton>
              </div>
              <span v-else class="text-xs text-gray-400">{{ row.original.reviewNote || '-' }}</span>
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <!-- 5. Tab 2: 佣金明细与订单归因 -->
    <div v-else-if="activeTab === 'commissions'" class="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
      <!-- 佣金结算流水 -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col min-h-0">
        <div class="mb-4 shrink-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.commissionsTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.commissionsSubtitle') }}</p>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="commissionColumns" :data="commissions" :loading="overviewPending" sticky>
            <template #amount-cell="{ row }">
              <span class="font-medium text-emerald-600 dark:text-emerald-400">{{ formatCurrencyAmount(row.original.amount, baseCurrency) }}</span>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
            </template>
          </UTable>
        </div>
      </div>

      <!-- 订单归因记录 -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col min-h-0">
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

    <!-- 6. Tab 3: 团队与业绩报表 -->
    <div v-else-if="activeTab === 'teams'" class="space-y-6 flex-1 min-h-0 flex flex-col">
      <!-- 大队长团队业绩看板 -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col shrink-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.teamReportTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.teamReportSubtitle') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">选择总代理：</span>
            <USelect v-model.number="selectedMasterAgentUserId" :items="masterAgentOptions" class="w-64" />
          </div>
        </div>

        <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
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
            <div class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ formatCurrencyAmount(teamReport?.summary?.totalSalesAmount, baseCurrency) }}</div>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.promo.teamCommissionAmount') }}</div>
            <div class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ formatCurrencyAmount(teamReport?.summary?.totalCommissionAmount, baseCurrency) }}</div>
          </div>
        </div>

        <div class="overflow-auto max-h-72">
          <UTable :columns="teamReportColumns" :data="teamReport?.rows || []" :loading="teamReportPending" sticky>
            <template #totalSalesAmount-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">{{ formatCurrencyAmount(row.original.totalSalesAmount, baseCurrency) }}</span>
            </template>
            <template #totalCommissionAmount-cell="{ row }">
              <span class="text-sm text-emerald-600 dark:text-emerald-400">{{ formatCurrencyAmount(row.original.totalCommissionAmount, baseCurrency) }}</span>
            </template>
          </UTable>
        </div>
      </div>

      <!-- 团队关系网与团队订单明细 -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
        <!-- 代理关系表 -->
        <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col min-h-0">
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
                  <UButton color="neutral" variant="ghost" icon="ph:arrows-clockwise" @click="openRelationModal(row.original)" :disabled="!hasAdminPerm('promo:edit')" />
                  <UButton color="error" variant="ghost" icon="ph:trash" @click="openRelationDeleteModal(row.original)" :disabled="!hasAdminPerm('promo:edit')" />
                </div>
              </template>
            </UTable>
          </div>
        </div>

        <!-- 团队订单明细 -->
        <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col min-h-0">
          <div class="mb-4 shrink-0">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.teamOrdersTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.teamOrdersSubtitle') }}</p>
          </div>
          <div class="flex-1 overflow-auto">
            <UTable :columns="teamOrderColumns" :data="teamOrders || []" :loading="teamOrdersPending" sticky>
              <template #amount-cell="{ row }">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrencyAmount(row.original.amount, row.original.currency || baseCurrency) }}</span>
              </template>
              <template #createdAt-cell="{ row }">
                <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(row.original.createdAt) }}</span>
              </template>
            </UTable>
          </div>
        </div>
      </div>
    </div>

    <!-- 7. Tab 4: 等级与规则设置 -->
    <div v-else-if="activeTab === 'settings'" class="space-y-6 flex-1 min-h-0 flex flex-col">
      <!-- 推广准入与返佣规则卡片 -->
      <div class="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800/50 dark:bg-[#121214]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white">推广准入与奖励规则</h2>
            <p class="mt-1 text-xs text-gray-500">配置用户获取推广权限的门槛规则与默认分润比例。</p>
          </div>
          <div class="flex items-center gap-3">
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              :loading="savingSettings"
              :disabled="!hasAdminPerm('promo:edit')"
              @click="saveSettings"
            >
              {{ $t('admin.promo.saveSettings') }}
            </UButton>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-gray-100 dark:border-white/5 pt-4">
          <UFormField label="准入模式">
            <USelect
              v-model="settingsForm.promoAccessMode"
              :items="promoAccessModeOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField label="最低累计消费 (USD)" description="用户累计消费达标即可解锁">
            <UInput
              v-model.number="settingsForm.promoMinSpendAmount"
              type="number"
              min="0"
              step="1"
              class="w-full"
              :disabled="settingsForm.promoAccessMode === 'open'"
            >
              <template #leading>$</template>
            </UInput>
          </UFormField>

          <UFormField label="默认推广返佣比例 (%)" description="普通用户邀请链接产生订单时的提成比例（0 ~ 100%）">
            <UInput
              v-model.number="settingsForm.promoDefaultCommissionRate"
              type="number"
              min="0"
              max="100"
              step="1"
              class="w-full"
            >
              <template #trailing>%</template>
            </UInput>
          </UFormField>
        </div>
      </div>

      <!-- 代理合伙人等级矩阵 -->
      <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 shadow-sm rounded-2xl p-5 flex flex-col flex-1 min-h-0">
        <div class="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.promo.tiersTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ $t('admin.promo.tiersSubtitle') }}</p>
          </div>
          <UButton v-if="hasAdminPerm('promo:edit')" color="primary" variant="soft" icon="ph:plus-bold" @click="openTierModal()">
            {{ $t('admin.promo.addTier') }}
          </UButton>
        </div>
        <div class="flex-1 overflow-auto">
          <UTable :columns="tierColumns" :data="tiers" :loading="tiersPending" sticky>
            <template #discountRate-cell="{ row }">
              <span class="text-sm text-gray-900 dark:text-white">{{ formatDiscount(row.original.discountRate) }}</span>
            </template>
            <template #salesThreshold-cell="{ row }">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatCurrencyAmount(row.original.salesThreshold, baseCurrency) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <UButton color="neutral" variant="ghost" icon="ph:pencil-simple" @click="openTierModal(row.original)" :disabled="!hasAdminPerm('promo:edit')" />
            </template>
          </UTable>
        </div>
      </div>
    </div>

    <!-- 8. 模态框收纳 -->
    <UModal v-model:open="auditModalOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ auditAction === 'approve' ? '审核通过合伙人申请' : '驳回申请' }}
          </h3>
          <div class="rounded-xl bg-gray-50 p-3 text-xs dark:bg-black/20 text-gray-600 dark:text-gray-300">
            <div><strong>申请人：</strong> {{ currentApplication?.userNickname || currentApplication?.userEmail }} (#{{ currentApplication?.userId }})</div>
            <div class="mt-1"><strong>联系方式：</strong> {{ currentApplication?.contact || '-' }}</div>
            <div class="mt-1"><strong>推广渠道：</strong> {{ currentApplication?.channelInfo || '-' }}</div>
            <div v-if="currentApplication?.reason" class="mt-1"><strong>申请说明：</strong> {{ currentApplication?.reason }}</div>
          </div>
          <UFormField label="审核备注 (选填)">
            <UInput v-model="auditNote" placeholder="填写审核说明或驳回理由" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="auditModalOpen = false">{{ $t('admin.common.cancel') }}</UButton>
            <UButton
              :color="auditAction === 'approve' ? 'success' : 'error'"
              :loading="savingAudit"
              :disabled="!hasAdminPerm('promo:edit')"
              @click="submitAudit"
            >
              {{ auditAction === 'approve' ? '确认通过' : '确认驳回' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

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
            <UButton color="primary" :loading="savingAgent" :disabled="!hasAdminPerm('promo:edit')" @click="saveAgent">{{ $t('admin.common.save') }}</UButton>
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
            <UButton color="primary" :loading="savingRelation" :disabled="!hasAdminPerm('promo:edit')" @click="saveRelation">{{ $t('admin.common.save') }}</UButton>
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
            <UButton color="error" :loading="deletingRelation" :disabled="!hasAdminPerm('promo:edit')" @click="deleteRelation">{{ $t('admin.common.delete') }}</UButton>
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
            <UButton color="primary" :loading="savingTier" :disabled="!hasAdminPerm('promo:edit')" @click="saveTier">{{ $t('admin.common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'

definePageMeta({ title: 'Promo Management', layout: 'admin' })

const { t } = useI18n()
const toast = useToast()
const { formatDateTime } = useFormatTime()
const { formatCurrencyAmount } = useCurrencyFormat()
const { getSetting, fetchSettings } = useSettings()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

await fetchSettings()
const baseCurrency = computed(() => getSetting('currency', 'USD'))

// Tab 状态
const activeTab = ref<'promoters' | 'commissions' | 'teams' | 'settings'>('promoters')

const { data: overviewData, pending: overviewPending, refresh: refreshOverview } = await useFetch<any>('/api/admin/promo/overview')
const { data: tiersData, pending: tiersPending, refresh: refreshTiers } = await useFetch<any[]>('/api/admin/promo/tiers')
const { data: agentsData, pending: agentsPending, refresh: refreshAgents } = await useFetch<any>('/api/admin/promo/agents', {
  query: { page: 1, pageSize: 100 },
})
const { data: relationsData, pending: relationsPending, refresh: refreshRelations } = await useFetch<any[]>('/api/admin/promo/relations')
const { data: settingsData, refresh: refreshSettings } = await useFetch<any>('/api/admin/promo/settings', {
  default: () => ({
    promo_default_commission_rate: '15',
    promo_invite_reward_amount: '0',
    promo_access_mode: 'paid_active',
    promo_min_spend_amount: '49',
  }),
})

const { data: applicationsData, pending: applicationsPending, refresh: refreshApplications } = await useFetch<any>('/api/admin/promo/applications', {
  query: { page: 1, pageSize: 50 },
  default: () => ({ list: [], total: 0 }),
})

const promoAccessModeOptions = [
  { label: '消费达标自动开通 (推荐)', value: 'paid_active' },
  { label: '人工申请审核', value: 'apply_audit' },
  { label: '消费达标 + 人工审核', value: 'paid_and_audit' },
  { label: '全员公开无门槛', value: 'open' },
]

const settingsForm = reactive({
  promoDefaultCommissionRate: 15,
  promoInviteRewardAmount: '0',
  promoAccessMode: 'paid_active',
  promoMinSpendAmount: 49,
})

watchEffect(() => {
  settingsForm.promoDefaultCommissionRate = Number(settingsData.value?.promo_default_commission_rate || 15)
  settingsForm.promoInviteRewardAmount = String(settingsData.value?.promo_invite_reward_amount || '0')
  settingsForm.promoAccessMode = String(settingsData.value?.promo_access_mode || 'paid_active')
  settingsForm.promoMinSpendAmount = Number(settingsData.value?.promo_min_spend_amount || 49)
})

const applications = computed(() => applicationsData.value?.list || [])
const pendingApplicationsCount = computed(() => applications.value.filter((item: any) => item.status === 'pending').length)

const promoTabs = computed(() => [
  {
    key: 'promoters' as const,
    label: '推广员与代理',
    icon: 'ph:users-duotone',
    badge: pendingApplicationsCount.value > 0 ? `${pendingApplicationsCount.value}` : undefined,
  },
  {
    key: 'commissions' as const,
    label: '佣金明细与订单',
    icon: 'ph:money-duotone',
  },
  {
    key: 'teams' as const,
    label: '团队与业绩报表',
    icon: 'ph:chart-line-up-duotone',
  },
  {
    key: 'settings' as const,
    label: '等级与规则设置',
    icon: 'ph:gear-six-duotone',
  },
])

const agentSearchKeyword = ref('')
const agentRoleFilter = ref('all')
const agentRoleFilterOptions = [
  { label: '全部角色', value: 'all' },
  { label: '子代理', value: 'agent' },
  { label: '总代理 (大队长)', value: 'master_agent' },
]

const auditModalOpen = ref(false)
const currentApplication = ref<any>(null)
const auditAction = ref<'approve' | 'reject'>('approve')
const auditNote = ref('')
const savingAudit = ref(false)

function openAuditModal(app: any, action: 'approve' | 'reject') {
  currentApplication.value = app
  auditAction.value = action
  auditNote.value = ''
  auditModalOpen.value = true
}

async function submitAudit() {
  if (!currentApplication.value?.id) return
  savingAudit.value = true
  try {
    await $fetch(`/api/admin/promo/applications/${currentApplication.value.id}/audit`, {
      method: 'POST',
      body: {
        action: auditAction.value,
        reviewNote: auditNote.value,
      },
    })
    auditModalOpen.value = false
    await Promise.all([refreshApplications(), refreshOverview(), refreshAgents()])
    toast.add({ title: auditAction.value === 'approve' ? '已审核通过并开通推广权限' : '已驳回申请', color: 'success' })
  } catch (error: any) {
    toast.add({ title: error?.data?.message || error?.data?.statusMessage || t('admin.promo.saveFailed'), color: 'error' })
  } finally {
    savingAudit.value = false
  }
}

const applicationColumns = computed(() => [
  { accessorKey: 'userEmail', header: '申请人' },
  { accessorKey: 'contact', header: '联系方式' },
  { accessorKey: 'channelInfo', header: '推广渠道' },
  { accessorKey: 'reason', header: '申请说明' },
  { accessorKey: 'status', header: '状态' },
  { accessorKey: 'createdAt', header: '申请时间' },
  { accessorKey: 'actions', header: t('admin.common.actions') },
])

const overviewCards = computed(() => {
  const overview = overviewData.value?.overview || {}
  return [
    { label: t('admin.promo.overviewMembers'), value: overview.members || 0 },
    { label: t('admin.promo.overviewAgents'), value: overview.agents || 0 },
    { label: t('admin.promo.overviewMasterAgents'), value: overview.masterAgents || 0 },
    { label: t('admin.promo.overviewOrders'), value: overview.attributedOrders || 0 },
    { label: t('admin.promo.overviewCommission'), value: formatCurrencyAmount(overview.commissionAmount, baseCurrency.value) },
  ]
})

const tiers = computed(() => tiersData.value || [])
const agents = computed(() => agentsData.value?.data || overviewData.value?.agents || [])
const relations = computed(() => relationsData.value || [])
const commissions = computed(() => overviewData.value?.commissions || [])
const attributions = computed(() => overviewData.value?.attributions || [])
const selectedMasterAgentUserId = ref<number | null>(null)

const filteredAgents = computed(() => {
  let list = agents.value || []
  if (agentRoleFilter.value !== 'all') {
    list = list.filter((item: any) => item.role === agentRoleFilter.value)
  }
  if (agentSearchKeyword.value.trim()) {
    const kw = agentSearchKeyword.value.trim().toLowerCase()
    list = list.filter((item: any) => {
      const email = String(item.email || '').toLowerCase()
      const nickname = String(item.nickname || '').toLowerCase()
      const promoCode = String(item.promoCode || '').toLowerCase()
      const agentCode = String(item.agentCode || '').toLowerCase()
      const userId = String(item.userId || '')
      return email.includes(kw) || nickname.includes(kw) || promoCode.includes(kw) || agentCode.includes(kw) || userId.includes(kw)
    })
  }
  return list
})

async function copyPromoText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: '已复制到剪贴板', color: 'success' })
  } catch {
    toast.add({ title: '复制失败', color: 'error' })
  }
}

const { data: teamReport, pending: teamReportPending, refresh: refreshTeamReport } = await useFetch<any>('/api/admin/promo/team-report', {
  query: computed(() => ({
    masterAgentUserId: selectedMasterAgentUserId.value || undefined,
  })),
  watch: [selectedMasterAgentUserId],
  default: () => ({
    summary: {
      teamCount: 0,
      paidOrderCount: 0,
      totalSalesAmount: 0,
      totalCommissionAmount: 0,
    },
    rows: [],
  }),
})

const { data: teamOrders, pending: teamOrdersPending, refresh: refreshTeamOrders } = await useFetch<any[]>('/api/admin/promo/team-orders', {
  query: computed(() => ({
    masterAgentUserId: selectedMasterAgentUserId.value || undefined,
  })),
  watch: [selectedMasterAgentUserId],
  default: () => [],
})

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
        promo_default_commission_rate: String(settingsForm.promoDefaultCommissionRate),
        promo_invite_reward_amount: settingsForm.promoInviteRewardAmount,
        promo_access_mode: settingsForm.promoAccessMode,
        promo_min_spend_amount: settingsForm.promoMinSpendAmount,
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
