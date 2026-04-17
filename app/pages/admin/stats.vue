<template>
  <div class="min-h-screen bg-[#09090b] p-4 md:p-8">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">{{ t('admin.stats.title') }}</h1>
        <p class="text-gray-400 mt-2 text-sm">{{ t('admin.stats.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 rounded-xl border border-gray-800 bg-[#121214] p-1">
          <button
            v-for="option in dayOptions"
            :key="option.value"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="preset === option.value ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'"
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
        class="bg-[#121214] p-5 rounded-2xl border border-gray-800/50"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">{{ card.label }}</span>
          <UIcon
            :name="card.icon"
            class="w-5 h-5"
            :class="card.iconClass"
          />
        </div>
        <div class="mt-4 text-3xl font-bold text-white tracking-tight">{{ card.value }}</div>
        <p class="mt-2 text-xs text-gray-500">{{ card.tip }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 mb-8">
      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('admin.stats.trafficTrend') }}</h2>
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
            <div class="space-y-2">
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
            <div class="text-right text-sm text-cyan-300">{{ formatNumber(item.pageViews) }}</div>
            <div class="text-right text-sm text-purple-300">{{ formatNumber(item.uniqueVisitors) }}</div>
            <div class="text-right text-sm text-emerald-300">{{ formatNumber(item.paidVisitors) }}</div>
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

      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <div>
          <h2 class="text-lg font-bold text-white">{{ t('admin.stats.funnel') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.funnelSubtitle') }}</p>
        </div>
        <div class="mt-6 space-y-4">
          <div
            v-for="step in funnelWithRate"
            :key="step.key"
            class="space-y-2"
          >
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-300">{{ step.label }}</span>
              <span class="text-white font-medium">{{ formatNumber(step.visitors) }} · {{ formatPercent(step.rate) }}</span>
            </div>
            <div class="h-2 rounded-full bg-white/5 overflow-hidden">
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
      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('admin.stats.firstTouch') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.firstTouchSubtitle') }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in firstTouchSources"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <div class="w-40 text-sm text-gray-300 truncate">{{ formatSourceLabel(item.label) }}</div>
            <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                class="h-full rounded-full bg-purple-500"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>
            <div class="w-16 text-right text-sm text-white">{{ formatNumber(item.count) }}</div>
          </div>
        </div>
      </div>

      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('admin.stats.lastTouch') }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.lastTouchSubtitle') }}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in lastTouchSources"
            :key="item.label"
            class="flex items-center gap-3"
          >
            <div class="w-40 text-sm text-gray-300 truncate">{{ formatSourceLabel(item.label) }}</div>
            <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                class="h-full rounded-full bg-cyan-500"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>
            <div class="w-16 text-right text-sm text-white">{{ formatNumber(item.count) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <h2 class="text-lg font-bold text-white">{{ t('admin.stats.sourceCategories') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.sourceCategoriesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in sourceCategories"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-300">{{ formatSourceLabel(item.label) }}</span>
            <span class="text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <h2 class="text-lg font-bold text-white">{{ t('admin.stats.externalSources') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.externalSourcesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in externalSources"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-300">{{ formatSourceLabel(item.label) }}</span>
            <span class="text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <h2 class="text-lg font-bold text-white">{{ t('admin.stats.regions') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.regionsSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in geography"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-300">{{ item.label }}</span>
            <span class="text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
        <h2 class="text-lg font-bold text-white">{{ t('admin.stats.devices') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.devicesSubtitle') }}</p>
        <div class="mt-5 space-y-3">
          <div
            v-for="item in devices"
            :key="item.label"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-300">{{ item.label }}</span>
            <span class="text-white">{{ formatNumber(item.count) }} · {{ formatPercent(item.percentage) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#121214] rounded-2xl border border-gray-800/50 p-6">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-lg font-bold text-white">{{ t('admin.stats.details') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ t('admin.stats.detailsSubtitle') }}</p>
        </div>
      </div>

      <UTabs
        v-model="activeDetailsTab"
        :items="detailsTabs"
        class="mb-4"
      />

      <div
        v-if="activeDetailsTab === 'visitors'"
        class="rounded-2xl border border-gray-800/50 overflow-hidden"
      >
        <div class="overflow-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-800">
                <th class="py-3 px-4">{{ t('admin.stats.visitor') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.firstSource') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.lastSource') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.region') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.device') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.landing') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.pageViews') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.checkout') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.paid') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in visitorRows"
                :key="item.visitorId"
                class="border-b border-gray-900/80"
              >
                <td class="py-3 px-4 text-gray-200 font-mono text-xs">{{ shortVisitor(item.visitorId) }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ formatSourceLabel(item.firstTouch) }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ formatSourceLabel(item.lastTouch) }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ item.country }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ item.deviceType }}</td>
                <td class="py-3 pr-4 text-gray-400 max-w-52 truncate">{{ item.landingPath }}</td>
                <td class="py-3 pr-4 text-white">{{ formatNumber(item.pageViews) }}</td>
                <td class="py-3 pr-4 text-amber-300">{{ formatNumber(item.checkouts) }}</td>
                <td class="py-3 pr-4 text-emerald-300">{{ formatNumber(item.paid) }}</td>
              </tr>
              <tr v-if="!visitorsPending && visitorRows.length === 0">
                <td
                  colspan="9"
                  class="px-4 py-10 text-center text-gray-500"
                >
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-gray-800/50 flex justify-between items-center bg-[#121214]">
          <div class="text-sm text-gray-400">
            {{ $t('admin.common.showing') }}
            <span class="text-white">{{ visitorTotalItems > 0 ? (visitorsPage - 1) * visitorsPageCount + 1 : 0 }}</span>
            {{ $t('admin.common.to') }}
            <span class="text-white">{{ Math.min(visitorsPage * visitorsPageCount, visitorTotalItems) }}</span>
            {{ $t('admin.common.of') }}
            <span class="text-white">{{ visitorTotalItems }}</span>
            {{ $t('admin.common.results') }}
          </div>
          <UPagination
            v-model="visitorsPage"
            :total="visitorTotalItems"
            :page-count="visitorsPageCount"
            :disabled="visitorsPending"
            @update:page="(val) => onVisitorsPageChange(val)"
          />
        </div>
      </div>

      <div
        v-else
        class="rounded-2xl border border-gray-800/50 overflow-hidden"
      >
        <div class="overflow-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-800">
                <th class="py-3 px-4">{{ t('admin.stats.event') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.visitor') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.source') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.region') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.path') }}</th>
                <th class="py-3 pr-4">{{ t('admin.stats.time') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in eventRows"
                :key="item.id"
                class="border-b border-gray-900/80"
              >
                <td class="py-3 px-4">
                  <UBadge
                    :color="eventColor(item.eventName)"
                    variant="subtle"
                  >
                    {{ eventLabel(item.eventName, item.eventAction) }}
                  </UBadge>
                </td>
                <td class="py-3 pr-4 text-gray-200 font-mono text-xs">{{ shortVisitor(item.visitorId) }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ formatSourceLabel(item.source) }}</td>
                <td class="py-3 pr-4 text-gray-300">{{ item.country }} / {{ item.deviceType }}</td>
                <td class="py-3 pr-4 text-gray-400 max-w-72 truncate">{{ item.path || '-' }}</td>
                <td class="py-3 pr-4 text-gray-400">{{ formatDateTime(item.createdAt) }}</td>
              </tr>
              <tr v-if="!eventsPending && eventRows.length === 0">
                <td
                  colspan="6"
                  class="px-4 py-10 text-center text-gray-500"
                >
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-gray-800/50 flex justify-between items-center bg-[#121214]">
          <div class="text-sm text-gray-400">
            {{ $t('admin.common.showing') }}
            <span class="text-white">{{ eventTotalItems > 0 ? (eventsPage - 1) * eventsPageCount + 1 : 0 }}</span>
            {{ $t('admin.common.to') }}
            <span class="text-white">{{ Math.min(eventsPage * eventsPageCount, eventTotalItems) }}</span>
            {{ $t('admin.common.of') }}
            <span class="text-white">{{ eventTotalItems }}</span>
            {{ $t('admin.common.results') }}
          </div>
          <UPagination
            v-model="eventsPage"
            :total="eventTotalItems"
            :page-count="eventsPageCount"
            :disabled="eventsPending"
            @update:page="(val) => onEventsPageChange(val)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: 'Visitor Stats' })

const { t, locale } = useI18n()
const router = useRouter()
const preset = ref('7d')
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
const activeDetailsTab = ref('visitors')
const detailsTabs = computed(() => [
  { label: t('admin.stats.visitorTab'), value: 'visitors', icon: 'ph:users' },
  {
    label: t('admin.stats.eventTab'),
    value: 'events',
    icon: 'ph:list-bullets',
  },
])
const {
  page: visitorsPage,
  pageSize: visitorsPageCount,
  onPageChange: onVisitorsPageChange,
} = usePagination(20)
const {
  page: eventsPage,
  pageSize: eventsPageCount,
  onPageChange: onEventsPageChange,
} = usePagination(20)
const visitorsUrl = computed(
  () =>
    `/api/admin/stats/visitors?preset=${preset.value}&days=${rangeDays.value}&page=${visitorsPage.value}&pageSize=${visitorsPageCount.value}`
)
const eventsUrl = computed(
  () =>
    `/api/admin/stats/events?preset=${preset.value}&days=${rangeDays.value}&page=${eventsPage.value}&pageSize=${eventsPageCount.value}`
)
const {
  data: visitorsData,
  pending: visitorsPending,
  refresh: refreshVisitors,
  error: visitorsError,
} = useFetch<any>(visitorsUrl)
const {
  data: eventsData,
  pending: eventsPending,
  refresh: refreshEvents,
  error: eventsError,
} = useFetch<any>(eventsUrl)
const visitorRows = computed(() => visitorsData.value?.items || [])
const eventRows = computed(() => eventsData.value?.items || [])
const visitorTotalItems = computed(() =>
  Number(visitorsData.value?.pagination?.totalItems || 0)
)
const eventTotalItems = computed(() =>
  Number(eventsData.value?.pagination?.totalItems || 0)
)

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
    tip: t('admin.stats.pageViewsTip'),
  },
  {
    label: t('admin.stats.uniqueVisitors'),
    value: formatNumber(overview.value.uniqueVisitors),
    icon: 'ph:users',
    iconClass: 'text-purple-400',
    tip: t('admin.stats.uniqueVisitorsTip'),
  },
  {
    label: t('admin.stats.todayVisitors'),
    value: formatNumber(overview.value.todayVisitors),
    icon: 'ph:clock-countdown',
    iconClass: 'text-amber-400',
    tip: t('admin.stats.todayVisitorsTip'),
  },
  {
    label: t('admin.stats.productVisitors'),
    value: formatNumber(overview.value.productVisitors),
    icon: 'ph:package',
    iconClass: 'text-blue-400',
    tip: t('admin.stats.productVisitorsTip'),
  },
  {
    label: t('admin.stats.checkoutVisitors'),
    value: formatNumber(overview.value.checkoutVisitors),
    icon: 'ph:shopping-cart-simple',
    iconClass: 'text-orange-400',
    tip: t('admin.stats.checkoutVisitorsTip'),
  },
  {
    label: t('admin.stats.paidVisitors'),
    value: formatNumber(overview.value.paidVisitors),
    icon: 'ph:credit-card',
    iconClass: 'text-emerald-400',
    tip: t('admin.stats.paidVisitorsTip'),
  },
  {
    label: t('admin.stats.authVisitors'),
    value: formatNumber(overview.value.authVisitors),
    icon: 'ph:sign-in',
    iconClass: 'text-pink-400',
    tip: t('admin.stats.authVisitorsTip'),
  },
  {
    label: t('admin.stats.conversionRate'),
    value: formatPercent(overview.value.conversionRate),
    icon: 'ph:funnel',
    iconClass: 'text-green-400',
    tip: t('admin.stats.conversionRateTip'),
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
}

watch(preset, () => {
  visitorsPage.value = 1
  eventsPage.value = 1
})

watch([visitorsError, eventsError], ([visitorError, eventError]: any[]) => {
  const error = visitorError || eventError
  if ((error as any)?.statusCode === 401) {
    router.push('/admin/login')
  }
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

function formatDateTime(value: string | Date) {
  if (!value) return '-'
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function eventLabel(eventName: string, eventAction?: string) {
  if (eventName === 'auth') {
    return eventAction === 'register'
      ? t('admin.stats.register')
      : t('admin.stats.login')
  }
  if (eventName === 'page_view') return t('admin.stats.pageView')
  if (eventName === 'product_view') return t('admin.stats.productView')
  if (eventName === 'begin_checkout') return t('admin.stats.beginCheckout')
  if (eventName === 'order_paid') return t('admin.stats.orderPaid')
  return eventName
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

function eventColor(eventName: string) {
  if (eventName === 'page_view') return 'info'
  if (eventName === 'product_view') return 'primary'
  if (eventName === 'begin_checkout') return 'warning'
  if (eventName === 'order_paid') return 'success'
  return 'neutral'
}
</script>
