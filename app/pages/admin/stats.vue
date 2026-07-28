<template>
  <div class="min-h-[calc(100vh-8rem)]">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ t('admin.stats.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ t('admin.stats.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] p-1">
          <button
            v-for="option in dayOptions"
            :key="option.value"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="preset === option.value ? 'bg-purple-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'"
            @click="preset = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          :loading="pending"
          @click="handleRefresh"
        >{{ t('admin.stats.refresh') }}</UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <div
        v-for="card in overviewCards"
        :key="card.label"
        class="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm transition-all"
        :class="card.clickable ? 'cursor-pointer hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5' : ''"
        @click="card.clickable && openModal(card.modalKey)"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ card.label }}</span>
          <UIcon
            :name="card.icon"
            class="w-5 h-5"
            :class="card.iconClass"
          />
        </div>
        <div class="mt-4 text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ card.value }}</div>
        <p class="mt-2 text-xs text-gray-500">{{ card.tip }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 mb-8">
      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.trafficTrend') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.trafficTrendSubtitle') }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in trend"
            :key="item.date"
            class="grid grid-cols-[72px_1fr_72px_72px_72px] gap-3 items-center"
          >
            <div class="text-xs text-gray-500">{{ item.label }}</div>
            <div class="space-y-2 bg-gray-100 dark:bg-transparent rounded-lg p-1">
              <div class="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  class="h-full rounded-full bg-cyan-500"
                  :style="{ width: `${getTrendWidth(item.pageViews, maxPageViews)}%` }"
                />
              </div>
              <div class="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  class="h-full rounded-full bg-purple-500"
                  :style="{ width: `${getTrendWidth(item.uniqueVisitors, maxUniqueVisitors)}%` }"
                />
              </div>
            </div>
            <div class="text-right text-sm text-cyan-600 dark:text-cyan-300">{{ formatNumber(item.pageViews) }}</div>
            <div class="text-right text-sm text-purple-600 dark:text-purple-300">{{ formatNumber(item.uniqueVisitors) }}</div>
            <div class="text-right text-sm text-emerald-600 dark:text-emerald-300">{{ formatNumber(item.paidVisitors) }}</div>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-6 text-xs text-gray-500">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            {{ t('admin.stats.pageViews') }}
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-purple-500" />
            {{ t('admin.stats.uniqueVisitors') }}
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {{ t('admin.stats.paidVisitors') }}
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.funnel') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.funnelSubtitle') }}</p>
        </div>
        <div class="mt-6 space-y-4">
          <div
            v-for="step in funnelWithRate"
            :key="step.key"
            class="space-y-2"
          >
            <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500 dark:text-gray-300">{{ step.label }}</span>
            <span class="text-gray-900 dark:text-white font-medium">{{ formatNumber(step.visitors) }} · {{ formatPercent(step.rate) }}</span>
            </div>
            <div class="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                class="h-full rounded-full bg-emerald-500"
                :style="{ width: `${step.rate}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.firstTouch') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.firstTouchSubtitle') }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in firstTouchSources"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <div class="w-40 text-sm text-gray-600 dark:text-gray-300 truncate">{{ formatSourceLabel(item.label) }}</div>
            <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                class="h-full rounded-full bg-purple-500"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>
            <div class="w-16 text-right text-sm text-gray-900 dark:text-white">{{ formatNumber(item.count) }}</div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.lastTouch') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.lastTouchSubtitle') }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in lastTouchSources"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <div class="w-40 text-sm text-gray-600 dark:text-gray-300 truncate">{{ formatSourceLabel(item.label) }}</div>
            <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                class="h-full rounded-full bg-cyan-500"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>
            <div class="w-16 text-right text-sm text-gray-900 dark:text-white">{{ formatNumber(item.count) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.sourceCategories') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.sourceCategoriesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in sourceCategories"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-500 dark:text-gray-300">{{ formatSourceLabel(item.label) }}</span>
            <span class="text-gray-900 dark:text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.externalSources') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.externalSourcesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in externalSources"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-500 dark:text-gray-300">{{ formatSourceLabel(item.label) }}</span>
            <span class="text-gray-900 dark:text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.regions') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.regionsSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in geography"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-600 dark:text-gray-300">{{ item.label }}</span>
            <span class="text-gray-900 dark:text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-[#121214] rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.stats.devices') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.devicesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in devices"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-600 dark:text-gray-300">{{ item.label }}</span>
            <span class="text-gray-900 dark:text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Data Cleanup -->
  <UCard class="mt-8">
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('admin.dataCleanup.title') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('admin.dataCleanup.description') }}</p>
        </div>
      </div>
    </template>

    <div class="flex items-center gap-3">
      <UInput
        v-model="cleanupDays"
        type="number"
        :min="1"
        :max="365"
        class="w-28"
        :placeholder="t('admin.dataCleanup.keepDaysPlaceholder')"
      />
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('admin.dataCleanup.keepDays') }}</span>
      <UButton
        color="error"
        variant="outline"
        :loading="isCleaningUp"
        :disabled="isCleaningUp || !hasAdminPerm('stats:edit')"
        @click="confirmCleanup"
      >
        {{ isCleaningUp ? t('admin.dataCleanup.cleaningUp') : t('admin.dataCleanup.cleanupBtn') }}
      </UButton>
    </div>
  </UCard>

  <!-- Visitor List Modal -->
  <FullScreenModal v-model="isModalOpen" :title="modalTitle" max-width="max-w-7xl">
    <div class="overflow-auto">
      <!-- Visitors table (visitorId-based) -->
      <table v-if="modalSource === 'visitors'" class="min-w-full text-sm">
        <thead class="sticky top-0 bg-white dark:bg-[#121214]">
          <tr class="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
            <th class="py-3 px-4 whitespace-nowrap">{{ t('admin.stats.visitor') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.registered') || 'Registered' }}</th>
            <th class="py-3 pr-4 whitespace-nowrap font-mono text-xs">{{ t('admin.stats.ip') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.firstSource') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.region') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.device') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">{{ t('admin.stats.pageViews') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">Products</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">{{ t('admin.stats.checkout') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">{{ t('admin.stats.paid') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">Auth</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.lastSeen') || 'Last Seen' }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">{{ t('admin.stats.visitorDetail.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in modalRows"
            :key="item.visitorId"
            class="border-b border-gray-100 dark:border-gray-900/80"
          >
            <td class="py-3 px-4 text-gray-700 dark:text-gray-200 font-mono text-xs">{{ shortVisitor(item.visitorId) }}</td>
            <td class="py-3 pr-4">
              <UBadge v-if="item.userId" color="success" variant="subtle" size="xs" class="whitespace-nowrap max-w-[160px] truncate" :title="item.user?.email || item.user?.nickname || ''">
                {{ item.user?.nickname || item.user?.email || 'Yes' }}
              </UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="xs">No</UBadge>
            </td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{{ item.ip || 'Local' }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ formatSourceLabel(item.firstTouch) }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ item.country }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ item.deviceType }}</td>
            <td class="py-3 pr-4 text-gray-900 dark:text-white text-right tabular-nums">{{ formatNumber(item.pageViews) }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 text-right tabular-nums">{{ formatNumber(item.productViews) }}</td>
            <td class="py-3 pr-4 text-amber-600 dark:text-amber-300 text-right tabular-nums">{{ formatNumber(item.checkouts) }}</td>
            <td class="py-3 pr-4 text-emerald-600 dark:text-emerald-300 text-right tabular-nums">{{ formatNumber(item.paid) }}</td>
            <td class="py-3 pr-4 text-pink-600 dark:text-pink-300 text-right tabular-nums">{{ formatNumber(item.auth) }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatDateTime(item.lastSeenAt) }}</td>
            <td class="py-3 pr-4 text-right">
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                size="sm"
                :title="t('admin.stats.visitorDetail.view')"
                @click="openVisitorDetail(item.visitorId)"
              />
            </td>
          </tr>
          <tr v-if="!modalPending && modalRows.length === 0">
            <td colspan="13" class="px-4 py-10 text-center text-gray-500">-</td>
          </tr>
        </tbody>
      </table>

      <!-- Page visits table (raw page_view events) -->
      <table v-else-if="modalSource === 'pageVisits'" class="min-w-full text-sm">
        <thead class="sticky top-0 bg-white dark:bg-[#121214]">
          <tr class="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
            <th class="py-3 px-4 whitespace-nowrap">{{ t('admin.stats.path') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.time') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.visitor') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap font-mono text-xs">{{ t('admin.stats.ip') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.referrer') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.device') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.browser') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.os') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.region') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in modalRows"
            :key="item.id"
            class="border-b border-gray-100 dark:border-gray-900/80"
          >
            <td class="py-3 px-4 text-gray-700 dark:text-gray-200 font-mono text-xs max-w-[200px] truncate" :title="item.path">{{ item.path }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatDateTime(item.createdAt) }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{{ shortVisitor(item.visitorId) }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{{ item.ip || 'Local' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs max-w-[150px] truncate" :title="item.referrer">{{ item.referrer || '-' }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ item.deviceType || '-' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{{ item.browser || '-' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{{ item.os || '-' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatRegionCity(item) }}</td>
          </tr>
          <tr v-if="!modalPending && modalRows.length === 0">
            <td colspan="9" class="px-4 py-10 text-center text-gray-500">-</td>
          </tr>
        </tbody>
      </table>

      <!-- IP table (events endpoint) -->
      <table v-else-if="modalSource === 'events'" class="min-w-full text-sm">
        <thead class="sticky top-0 bg-white dark:bg-[#121214]">
          <tr class="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
            <th class="py-3 px-4 whitespace-nowrap">{{ t('admin.stats.ip') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.visitor') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap text-right">{{ t('admin.stats.visits') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.registered') || 'Registered' }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.country') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.regionCity') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.device') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.browser') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.os') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.firstSeen') }}</th>
            <th class="py-3 pr-4 whitespace-nowrap">{{ t('admin.stats.lastSeen') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in modalRows"
            :key="item.ip"
            class="border-b border-gray-100 dark:border-gray-900/80"
          >
            <td class="py-3 px-4 text-gray-700 dark:text-gray-200 font-mono text-xs">{{ item.ip || 'Local' }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{{ shortVisitor(item.visitorId) }}</td>
            <td class="py-3 pr-4 text-gray-900 dark:text-white text-right tabular-nums">{{ formatNumber(item.visitCount) }}</td>
            <td class="py-3 pr-4">
              <UBadge :color="item.isRegistered ? 'success' : 'neutral'" variant="subtle" size="xs">{{ item.isRegistered ? 'Yes' : 'No' }}</UBadge>
            </td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ item.country }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatRegionCity(item) }}</td>
            <td class="py-3 pr-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ item.deviceType }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{{ item.browser || '-' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">{{ item.os || '-' }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatDateTime(item.firstSeenAt) }}</td>
            <td class="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ formatDateTime(item.lastSeenAt) }}</td>
          </tr>
          <tr v-if="!modalPending && modalRows.length === 0">
            <td colspan="11" class="px-4 py-10 text-center text-gray-500">-</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.common.showing') }}
          <span class="text-gray-900 dark:text-white">{{ modalTotalItems > 0 ? (modalPage - 1) * modalPageSize + 1 : 0 }}</span>
          {{ $t('admin.common.to') }}
          <span class="text-gray-900 dark:text-white">{{ Math.min(modalPage * modalPageSize, modalTotalItems) }}</span>
          {{ $t('admin.common.of') }}
          <span class="text-gray-900 dark:text-white">{{ modalTotalItems }}</span>
          {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="modalPage"
          :total="modalTotalItems"
          :page-count="modalPageSize"
          :disabled="modalPending"
          @update:page="(val) => onModalPageChange(val)"
        />
      </div>
    </template>
  </FullScreenModal>
  <AdminStatsVisitorDetailModal
    v-model:open="isVisitorDetailOpen"
    :visitor-id="selectedVisitorId"
  />
</template>

<script setup lang="ts">
definePageMeta({ title: 'Visitor Stats', layout: 'admin' })

const { t, locale } = useI18n()
const { formatDateTime } = useFormatTime()
const router = useRouter()
const preset = ref('today')
const rangeDays = computed(() => {
  if (preset.value === 'today' || preset.value === 'yesterday') {
    return 1
  }
  return Number.parseInt(preset.value.replace('d', ''), 10) || 7
})
const dayOptions = computed(() => [
  { value: 'today', label: t('admin.stats.today') },
  { value: 'yesterday', label: t('admin.stats.yesterday') },
  { value: '7d', label: t('admin.stats.last7Days') },
  { value: '30d', label: t('admin.stats.last30Days') },
  { value: '90d', label: t('admin.stats.last90Days') },
])
const statsUrl = computed(
  () =>
    `/api/admin/stats?preset=${preset.value}&days=${rangeDays.value}&limit=50`
)

const { data, pending, refresh, error } = useFetch<any>(statsUrl)

watch(error, (value: any) => {
  if ((value as any)?.statusCode === 401) {
    router.push('/admin/login')
  }
})

const overview = computed(() => data.value?.overview || {})
const trend = computed(() => data.value?.trend || [])
const geography = computed(() => data.value?.geography || [])
const devices = computed(() => data.value?.devices || [])
const sourceCategories = computed(() => data.value?.sources?.categories || [])
const externalSources = computed(() => data.value?.sources?.external || [])
const firstTouchSources = computed(() => data.value?.sources?.firstTouch || [])
const lastTouchSources = computed(() => data.value?.sources?.lastTouch || [])
const funnel = computed(() => data.value?.funnel || [])

// Modal state
const isModalOpen = ref(false)
const modalTitle = ref('')
const modalSource = ref<'visitors' | 'events' | 'pageVisits'>('visitors')
const modalEventType = ref('')
const modalSourceType = ref('')
const isVisitorDetailOpen = ref(false)
const selectedVisitorId = ref<string | null>(null)

function openVisitorDetail(visitorId: string) {
  selectedVisitorId.value = visitorId
  isVisitorDetailOpen.value = true
}

function openModal(key: string) {
  modalSourceType.value = ''
  modalEventType.value = ''

  if (key === 'pageViews') {
    modalTitle.value = t('admin.stats.pageViewsModalTitle')
    modalSource.value = 'visitors'
    modalEventType.value = 'page_view'
  } else if (key === 'pageVisits') {
    modalTitle.value = t('admin.stats.pageVisitsModalTitle')
    modalSource.value = 'pageVisits'
  } else if (key === 'uniqueVisitors') {
    modalTitle.value = t('admin.stats.uniqueVisitorsModalTitle')
    modalSource.value = 'visitors'
  } else if (key === 'todayIp') {
    modalTitle.value = t('admin.stats.todayIpModalTitle')
    modalSource.value = 'events'
  } else if (key === 'productVisitors') {
    modalTitle.value = t('admin.stats.productVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalEventType.value = 'product_view'
  } else if (key === 'checkoutVisitors') {
    modalTitle.value = t('admin.stats.checkoutVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalEventType.value = 'begin_checkout'
  } else if (key === 'paidVisitors') {
    modalTitle.value = t('admin.stats.paidVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalEventType.value = 'order_paid'
  } else if (key === 'authVisitors') {
    modalTitle.value = t('admin.stats.authVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalEventType.value = 'auth'
  } else if (key === 'externalVisitors') {
    modalTitle.value = t('admin.stats.externalVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalSourceType.value = 'external'
  } else if (key === 'campaignVisitors') {
    modalTitle.value = t('admin.stats.campaignVisitorsModalTitle')
    modalSource.value = 'visitors'
    modalSourceType.value = 'campaign'
  }
  isModalOpen.value = true
}

const {
  page: modalPage,
  pageSize: modalPageSize,
  onPageChange: onModalPageChange,
} = usePagination(20)

// Visitors endpoint (with optional type/sourceType filter)
const visitorsUrl = computed(
  () => {
    let url = `/api/admin/stats/visitors?preset=${preset.value}&days=${rangeDays.value}&page=${modalPage.value}&pageSize=${modalPageSize.value}`
    if (modalEventType.value) {
      url += `&type=${modalEventType.value}`
    }
    if (modalSourceType.value) {
      url += `&sourceType=${modalSourceType.value}`
    }
    return url
  }
)

// Events endpoint (IP-based)
const eventsUrl = computed(
  () =>
    `/api/admin/stats/events?preset=${preset.value}&days=${rangeDays.value}&page=${modalPage.value}&pageSize=${modalPageSize.value}`
)

// Page visits endpoint (raw page_view events)
const pageVisitsUrl = computed(
  () =>
    `/api/admin/stats/page-visits?preset=${preset.value}&days=${rangeDays.value}&page=${modalPage.value}&pageSize=${modalPageSize.value}`
)

const {
  data: visitorsData,
  pending: visitorsPending,
  refresh: refreshVisitors,
  error: visitorsError,
} = useFetch<any>(visitorsUrl, { immediate: true })

const {
  data: eventsData,
  pending: eventsPending,
  refresh: refreshEvents,
  error: eventsError,
} = useFetch<any>(eventsUrl, { immediate: true })

const {
  data: pageVisitsData,
  pending: pageVisitsPending,
  refresh: refreshPageVisits,
  error: pageVisitsError,
} = useFetch<any>(pageVisitsUrl, { immediate: true })

const visitorRows = computed(() => visitorsData.value?.items || [])
const visitorTotalItems = computed(() =>
  Number(visitorsData.value?.pagination?.totalItems || 0)
)
const eventRows = computed(() => eventsData.value?.items || [])
const eventTotalItems = computed(() =>
  Number(eventsData.value?.pagination?.totalItems || 0)
)
const pageVisitRows = computed(() => pageVisitsData.value?.items || [])
const pageVisitTotalItems = computed(() =>
  Number(pageVisitsData.value?.pagination?.totalItems || 0)
)

const modalRows = computed(() =>
  modalSource.value === 'events' ? eventRows.value
    : modalSource.value === 'pageVisits' ? pageVisitRows.value
    : visitorRows.value
)
const modalTotalItems = computed(() =>
  modalSource.value === 'events' ? eventTotalItems.value
    : modalSource.value === 'pageVisits' ? pageVisitTotalItems.value
    : visitorTotalItems.value
)
const modalPending = computed(() =>
  modalSource.value === 'events' ? eventsPending.value
    : modalSource.value === 'pageVisits' ? pageVisitsPending.value
    : visitorsPending.value
)

// 401 guard
watch([visitorsError, eventsError, pageVisitsError], ([vErr, eErr, pErr]: any[]) => {
  const err = vErr || eErr || pErr
  if (err?.statusCode === 401) {
    router.push('/admin/login')
  }
})

const maxPageViews = computed(() =>
  Math.max(...trend.value.map((item: any) => Number(item.pageViews || 0)), 1)
)
const maxUniqueVisitors = computed(() =>
  Math.max(
    ...trend.value.map((item: any) => Number(item.uniqueVisitors || 0)),
    1
  )
)

const overviewCards = computed(() => [
  {
    label: t('admin.stats.pageViews'),
    value: formatNumber(overview.value.pageViews),
    icon: 'ph:chart-line-up',
    iconClass: 'text-cyan-400',
    tip: t('admin.stats.pageVisitsTip'),
    clickable: true,
    modalKey: 'pageVisits',
  },
  {
    label: t('admin.stats.uniqueVisitors'),
    value: formatNumber(overview.value.uniqueVisitors),
    icon: 'ph:users',
    iconClass: 'text-purple-400',
    tip: t('admin.stats.uniqueVisitorsTip'),
    clickable: true,
    modalKey: 'uniqueVisitors',
  },
  {
    label: t('admin.stats.todayVisitors'),
    value: formatNumber(overview.value.todayVisitors),
    icon: 'ph:clock-countdown',
    iconClass: 'text-amber-400',
    tip: t('admin.stats.todayVisitorsTip'),
    clickable: true,
    modalKey: 'todayIp',
  },
  {
    label: t('admin.stats.productVisitors'),
    value: formatNumber(overview.value.productVisitors),
    icon: 'ph:package',
    iconClass: 'text-blue-400',
    tip: t('admin.stats.productVisitorsTip'),
    clickable: true,
    modalKey: 'productVisitors'
  },
  {
    label: t('admin.stats.checkoutVisitors'),
    value: formatNumber(overview.value.checkoutVisitors),
    icon: 'ph:shopping-cart-simple',
    iconClass: 'text-orange-400',
    tip: t('admin.stats.checkoutVisitorsTip'),
    clickable: true,
    modalKey: 'checkoutVisitors'
  },
  {
    label: t('admin.stats.paidVisitors'),
    value: formatNumber(overview.value.paidVisitors),
    icon: 'ph:credit-card',
    iconClass: 'text-emerald-400',
    tip: t('admin.stats.paidVisitorsTip'),
    clickable: true,
    modalKey: 'paidVisitors'
  },
  {
    label: t('admin.stats.authVisitors'),
    value: formatNumber(overview.value.authVisitors),
    icon: 'ph:sign-in',
    iconClass: 'text-pink-400',
    tip: t('admin.stats.authVisitorsTip'),
    clickable: true,
    modalKey: 'authVisitors'
  },
  {
    label: t('admin.stats.externalVisitors'),
    value: formatNumber(overview.value.externalVisitors),
    icon: 'ph:share-network',
    iconClass: 'text-sky-400',
    tip: t('admin.stats.externalVisitorsTip'),
    clickable: true,
    modalKey: 'externalVisitors'
  },
  {
    label: t('admin.stats.campaignVisitors'),
    value: formatNumber(overview.value.campaignVisitors),
    icon: 'ph:megaphone',
    iconClass: 'text-rose-400',
    tip: t('admin.stats.campaignVisitorsTip'),
    clickable: true,
    modalKey: 'campaignVisitors'
  },
  {
    label: t('admin.stats.conversionRate'),
    value: formatPercent(overview.value.conversionRate),
    icon: 'ph:funnel',
    iconClass: 'text-green-400',
    tip: t('admin.stats.conversionRateTip'),
    clickable: false,
    modalKey: ''
  },
])

const funnelWithRate = computed(() => {
  const base = Number(funnel.value[0]?.visitors || 0)
  return funnel.value.map((item: any) => ({
    ...item,
    rate:
      base > 0
        ? Number(((Number(item.visitors || 0) / base) * 100).toFixed(1))
        : 0,
  }))
})

function handleRefresh() {
  refresh()
  refreshVisitors()
  refreshEvents()
  refreshPageVisits()
}

watch(preset, () => {
  modalPage.value = 1
})

function formatNumber(value: number | string | undefined) {
  return new Intl.NumberFormat(
    locale.value === 'zh' ? 'zh-CN' : 'en-US'
  ).format(Number(value || 0))
}

function formatPercent(value: number | string | undefined) {
  return `${Number(value || 0).toFixed(1)}%`
}

function getTrendWidth(value: number, max: number) {
  if (!max) return 0
  return Number(((value / max) * 100).toFixed(1))
}

function shortVisitor(value: string) {
  if (!value) return '-'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function formatSourceLabel(value: string) {
  if (!value) return '-'
  const normalized = value.toLowerCase()
  if (normalized === 'direct') return t('admin.stats.direct')
  if (normalized === 'search') return t('admin.stats.search')
  if (normalized === 'social') return t('admin.stats.social')
  if (normalized === 'referral') return t('admin.stats.referral')
  if (normalized === 'campaign') return t('admin.stats.campaign')
  return value
}

function formatRegionCity(item: any) {
  const parts = [item.region, item.city].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : '-'
}

// Data cleanup
const cleanupDays = ref(90)
const isCleaningUp = ref(false)

const { confirm } = useConfirm()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

async function confirmCleanup() {
  const confirmed = await confirm({
    title: t('admin.dataCleanup.confirmTitle'),
    description: t('admin.dataCleanup.confirmMessage', { days: cleanupDays.value }),
  })
  if (!confirmed) return

  isCleaningUp.value = true
  try {
    const result: any = await $fetch('/api/admin/stats/cleanup', {
      method: 'POST',
      body: { days: cleanupDays.value },
    })
    useToast().add({
      title: t('admin.dataCleanup.success', { count: result.deletedCount, days: cleanupDays.value }),
      color: 'success',
    })
  } catch (e) {
    useToast().add({
      title: t('admin.dataCleanup.error'),
      color: 'error',
      description: String(e),
    })
  } finally {
    isCleaningUp.value = false
  }
}
</script>
