export type StatsModalSource = 'visitors' | 'events' | 'pageVisits'

export interface StatsModalConfig {
  title: string
  source: StatsModalSource
  eventType: string
  sourceType: string
}

type Translate = (key: string) => string
type FormatValue = (value: number | string | undefined) => string

const modalDefinitions: Record<string, {
  titleKey: string
  source: StatsModalSource
  eventType?: string
  sourceType?: string
}> = {
  pageViews: { titleKey: 'admin.stats.pageViewsModalTitle', source: 'visitors', eventType: 'page_view' },
  pageVisits: { titleKey: 'admin.stats.pageVisitsModalTitle', source: 'pageVisits' },
  uniqueVisitors: { titleKey: 'admin.stats.uniqueVisitorsModalTitle', source: 'visitors' },
  todayIp: { titleKey: 'admin.stats.todayIpModalTitle', source: 'events' },
  productVisitors: { titleKey: 'admin.stats.productVisitorsModalTitle', source: 'visitors', eventType: 'product_view' },
  checkoutVisitors: { titleKey: 'admin.stats.checkoutVisitorsModalTitle', source: 'visitors', eventType: 'begin_checkout' },
  paidVisitors: { titleKey: 'admin.stats.paidVisitorsModalTitle', source: 'visitors', eventType: 'order_paid' },
  authVisitors: { titleKey: 'admin.stats.authVisitorsModalTitle', source: 'visitors', eventType: 'auth' },
  externalVisitors: { titleKey: 'admin.stats.externalVisitorsModalTitle', source: 'visitors', sourceType: 'external' },
  campaignVisitors: { titleKey: 'admin.stats.campaignVisitorsModalTitle', source: 'visitors', sourceType: 'campaign' },
}

export const resolveStatsModal = (key: string, translate: Translate): StatsModalConfig | null => {
  const definition = modalDefinitions[key]
  if (!definition) return null
  return {
    title: translate(definition.titleKey),
    source: definition.source,
    eventType: definition.eventType || '',
    sourceType: definition.sourceType || '',
  }
}

export const buildStatsOverviewCards = (
  overview: Record<string, any>,
  translate: Translate,
  formatNumber: FormatValue,
  formatPercent: FormatValue,
) => [
  {
    label: translate('admin.stats.pageViews'),
    value: formatNumber(overview.pageViews),
    icon: 'ph:chart-line-up',
    iconClass: 'text-cyan-400',
    tip: translate('admin.stats.pageVisitsTip'),
    clickable: true,
    modalKey: 'pageVisits',
  },
  {
    label: translate('admin.stats.uniqueVisitors'),
    value: formatNumber(overview.uniqueVisitors),
    icon: 'ph:users',
    iconClass: 'text-purple-400',
    tip: translate('admin.stats.uniqueVisitorsTip'),
    clickable: true,
    modalKey: 'uniqueVisitors',
  },
  {
    label: translate('admin.stats.todayVisitors'),
    value: formatNumber(overview.todayVisitors),
    icon: 'ph:clock-countdown',
    iconClass: 'text-amber-400',
    tip: translate('admin.stats.todayVisitorsTip'),
    clickable: true,
    modalKey: 'todayIp',
  },
  {
    label: translate('admin.stats.productVisitors'),
    value: formatNumber(overview.productVisitors),
    icon: 'ph:package',
    iconClass: 'text-blue-400',
    tip: translate('admin.stats.productVisitorsTip'),
    clickable: true,
    modalKey: 'productVisitors',
  },
  {
    label: translate('admin.stats.checkoutVisitors'),
    value: formatNumber(overview.checkoutVisitors),
    icon: 'ph:shopping-cart-simple',
    iconClass: 'text-orange-400',
    tip: translate('admin.stats.checkoutVisitorsTip'),
    clickable: true,
    modalKey: 'checkoutVisitors',
  },
  {
    label: translate('admin.stats.paidVisitors'),
    value: formatNumber(overview.paidVisitors),
    icon: 'ph:credit-card',
    iconClass: 'text-emerald-400',
    tip: translate('admin.stats.paidVisitorsTip'),
    clickable: true,
    modalKey: 'paidVisitors',
  },
  {
    label: translate('admin.stats.authVisitors'),
    value: formatNumber(overview.authVisitors),
    icon: 'ph:sign-in',
    iconClass: 'text-pink-400',
    tip: translate('admin.stats.authVisitorsTip'),
    clickable: true,
    modalKey: 'authVisitors',
  },
  {
    label: translate('admin.stats.externalVisitors'),
    value: formatNumber(overview.externalVisitors),
    icon: 'ph:share-network',
    iconClass: 'text-sky-400',
    tip: translate('admin.stats.externalVisitorsTip'),
    clickable: true,
    modalKey: 'externalVisitors',
  },
  {
    label: translate('admin.stats.campaignVisitors'),
    value: formatNumber(overview.campaignVisitors),
    icon: 'ph:megaphone',
    iconClass: 'text-rose-400',
    tip: translate('admin.stats.campaignVisitorsTip'),
    clickable: true,
    modalKey: 'campaignVisitors',
  },
  {
    label: translate('admin.stats.conversionRate'),
    value: formatPercent(overview.conversionRate),
    icon: 'ph:funnel',
    iconClass: 'text-green-400',
    tip: translate('admin.stats.conversionRateTip'),
    clickable: false,
    modalKey: '',
  },
]
