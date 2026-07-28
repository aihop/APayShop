<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-6xl' }">
    <template #content>
      <UCard class="max-h-[90vh] overflow-hidden bg-white ring-1 ring-gray-200 dark:bg-[#121214] dark:ring-gray-800">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <UIcon name="ph:user-focus" class="h-5 w-5 shrink-0 text-purple-500" />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('admin.stats.visitorDetail.title') }}</h3>
                <UBadge :color="detail?.user ? 'success' : 'neutral'" variant="subtle" size="xs">
                  {{ detail?.user ? t('admin.stats.visitorDetail.registered') : t('admin.stats.visitorDetail.anonymous') }}
                </UBadge>
              </div>
              <button
                v-if="visitorId"
                type="button"
                class="mt-1 max-w-full truncate font-mono text-xs text-gray-500 hover:text-purple-500"
                :title="t('admin.stats.visitorDetail.copy')"
                @click="copy(visitorId)"
              >{{ visitorId }}</button>
            </div>
            <UButton color="neutral" variant="ghost" icon="ph:x" @click="isOpen = false" />
          </div>
        </template>

        <div class="max-h-[calc(90vh-8rem)] overflow-y-auto pr-1">
          <div v-if="pending" class="flex min-h-72 items-center justify-center">
            <UIcon name="ph:spinner-gap" class="h-7 w-7 animate-spin text-purple-500" />
          </div>

          <div v-else-if="errorMessage" class="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <UIcon name="ph:warning-circle" class="h-9 w-9 text-red-500" />
            <p class="text-sm text-gray-500">{{ errorMessage }}</p>
            <UButton color="neutral" variant="outline" icon="ph:arrows-clockwise" @click="load">{{ t('admin.stats.refresh') }}</UButton>
          </div>

          <div v-else-if="detail" class="space-y-6">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <div v-for="card in statCards" :key="card.label" class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-black/20">
                <div class="text-xs text-gray-500">{{ card.label }}</div>
                <div class="mt-1 text-lg font-semibold tabular-nums" :class="card.class">{{ card.value }}</div>
              </div>
            </div>

            <AdminStatsDetailSection :title="t('admin.stats.visitorDetail.identity')" icon="ph:identification-card">
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AdminStatsDetailField v-for="field in identityFields" :key="field.label" :label="field.label" :value="field.value" :copyable="field.copyable" @copy="copy" />
              </div>
            </AdminStatsDetailSection>

            <AdminStatsDetailSection :title="t('admin.stats.visitorDetail.locationDevice')" icon="ph:devices">
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStatsDetailField v-for="field in deviceFields" :key="field.label" :label="field.label" :value="field.value" />
              </div>
              <div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
                <AdminStatsDetailField :label="t('admin.stats.visitorDetail.userAgent')" :value="detail.profile.userAgent" />
              </div>
            </AdminStatsDetailSection>

            <div class="grid gap-6 lg:grid-cols-2">
              <AdminStatsDetailSection :title="t('admin.stats.visitorDetail.firstTouch')" icon="ph:arrow-line-down-left">
                <div class="space-y-3">
                  <AdminStatsDetailField v-for="field in firstTouchFields" :key="field.label" :label="field.label" :value="field.value" />
                </div>
              </AdminStatsDetailSection>
              <AdminStatsDetailSection :title="t('admin.stats.visitorDetail.lastTouch')" icon="ph:arrow-line-up-right">
                <div class="space-y-3">
                  <AdminStatsDetailField v-for="field in lastTouchFields" :key="field.label" :label="field.label" :value="field.value" />
                </div>
              </AdminStatsDetailSection>
            </div>

            <AdminStatsDetailSection :title="`${t('admin.stats.visitorDetail.orders')} (${detail.stats.orders})`" icon="ph:receipt">
              <div v-if="!detail.orders.length" class="py-8 text-center text-sm text-gray-500">{{ t('admin.stats.visitorDetail.noOrders') }}</div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead><tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                    <th class="pb-2 pr-4">{{ t('admin.stats.visitorDetail.orderId') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.visitorDetail.product') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.visitorDetail.amount') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.visitorDetail.status') }}</th>
                    <th class="pb-2">{{ t('admin.stats.time') }}</th>
                  </tr></thead>
                  <tbody><tr v-for="order in detail.orders" :key="order.id" class="border-b border-gray-100 dark:border-gray-900">
                    <td class="py-2.5 pr-4 font-mono text-xs text-gray-500">{{ order.id }}</td>
                    <td class="py-2.5 pr-4 text-gray-900 dark:text-white">{{ order.productName || '-' }}</td>
                    <td class="py-2.5 pr-4 tabular-nums">{{ order.amount }} {{ order.currency }}</td>
                    <td class="py-2.5 pr-4"><UBadge :color="order.payStatus === 'paid' ? 'success' : 'neutral'" variant="subtle" size="xs">{{ order.payStatus }} · {{ order.status }}</UBadge></td>
                    <td class="py-2.5 text-xs text-gray-500 whitespace-nowrap">{{ formatDateTime(order.createdAt) }}</td>
                  </tr></tbody>
                </table>
              </div>
            </AdminStatsDetailSection>

            <AdminStatsDetailSection :title="`${t('admin.stats.visitorDetail.timeline')} (${detail.stats.totalEvents})`" icon="ph:clock-counter-clockwise">
              <p v-if="detail.stats.totalEvents > detail.recentEventsLimit" class="mb-3 text-xs text-gray-500">
                {{ t('admin.stats.visitorDetail.timelineLimit', { count: detail.recentEventsLimit }) }}
              </p>
              <div v-if="!detail.recentEvents.length" class="py-8 text-center text-sm text-gray-500">{{ t('admin.stats.visitorDetail.noEvents') }}</div>
              <div v-else class="space-y-3">
                <div v-for="item in detail.recentEvents" :key="item.id" class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <UBadge color="primary" variant="subtle" size="xs">{{ eventLabel(item.eventName) }}</UBadge>
                      <span v-if="item.eventAction" class="text-xs text-gray-500">{{ item.eventAction }}</span>
                      <span v-if="item.productName" class="text-xs text-blue-500">{{ item.productName }}</span>
                    </div>
                    <span class="text-xs text-gray-500">{{ formatDateTime(item.createdAt) }}</span>
                  </div>
                  <div class="mt-2 grid gap-2 text-xs lg:grid-cols-2">
                    <div class="break-all font-mono text-gray-700 dark:text-gray-300">{{ item.path || '-' }}</div>
                    <div class="break-all text-gray-500">{{ item.referrer || '-' }}</div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>{{ item.ip || '-' }}</span><span>{{ location(item) }}</span><span>{{ [item.deviceType, item.browser, item.os].filter(Boolean).join(' · ') || '-' }}</span>
                    <span>{{ [item.source, item.medium, item.campaign].filter(Boolean).join(' / ') || t('admin.stats.direct') }}</span>
                    <span v-if="item.orderId">{{ t('admin.stats.visitorDetail.orderId') }}: {{ item.orderId }}</span>
                  </div>
                </div>
              </div>
            </AdminStatsDetailSection>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; visitorId: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()

const isOpen = computed({ get: () => props.open, set: value => emit('update:open', value) })
const detail = ref<any>(null)
const pending = ref(false)
const errorMessage = ref('')

const location = (input: any) => [input.city, input.region, input.country].filter(Boolean).join(' / ') || '-'

const load = async () => {
  if (!props.visitorId) return
  pending.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    detail.value = await $fetch(`/api/admin/stats/visitors/${encodeURIComponent(props.visitorId)}`)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || t('admin.stats.visitorDetail.loadError')
  } finally {
    pending.value = false
  }
}

watch(() => [props.open, props.visitorId] as const, ([open]) => { if (open) load() })

const statCards = computed(() => detail.value ? [
  { label: t('admin.stats.visitorDetail.totalEvents'), value: detail.value.stats.totalEvents, class: 'text-gray-900 dark:text-white' },
  { label: t('admin.stats.pageViews'), value: detail.value.stats.pageViews, class: 'text-cyan-500' },
  { label: t('admin.stats.productVisitors'), value: detail.value.stats.productViews, class: 'text-blue-500' },
  { label: t('admin.stats.checkout'), value: detail.value.stats.checkouts, class: 'text-amber-500' },
  { label: t('admin.stats.paid'), value: detail.value.stats.paid, class: 'text-emerald-500' },
  { label: 'Auth', value: detail.value.stats.auth, class: 'text-pink-500' },
  { label: t('admin.stats.visitorDetail.orders'), value: detail.value.stats.orders, class: 'text-purple-500' },
] : [])

const identityFields = computed(() => detail.value ? [
  { label: t('admin.stats.visitorDetail.visitorId'), value: detail.value.profile.visitorId, copyable: true },
  { label: t('admin.stats.ip'), value: detail.value.profile.ip, copyable: true },
  { label: t('admin.stats.visitorDetail.userId'), value: detail.value.user?.id },
  { label: t('admin.stats.visitorDetail.email'), value: detail.value.user?.email },
  { label: t('admin.stats.visitorDetail.nickname'), value: detail.value.user?.nickname },
  {
    label: t('admin.stats.visitorDetail.accountStatus'),
    value: detail.value.user
      ? t(detail.value.user.status === 1 ? 'admin.stats.visitorDetail.statusActive' : 'admin.stats.visitorDetail.statusDisabled')
      : undefined,
  },
  { label: t('admin.stats.firstSeen'), value: formatDateTime(detail.value.profile.firstSeenAt) },
  { label: t('admin.stats.lastSeen'), value: formatDateTime(detail.value.profile.lastSeenAt) },
  { label: t('admin.stats.visitorDetail.registeredAt'), value: detail.value.user?.createdAt ? formatDateTime(detail.value.user.createdAt) : '-' },
] : [])

const deviceFields = computed(() => detail.value ? [
  { label: t('admin.stats.country'), value: detail.value.profile.country },
  { label: t('admin.stats.region'), value: detail.value.profile.region },
  { label: t('admin.stats.visitorDetail.city'), value: detail.value.profile.city },
  { label: t('admin.stats.device'), value: detail.value.profile.deviceType },
  { label: t('admin.stats.browser'), value: detail.value.profile.browser },
  { label: t('admin.stats.os'), value: detail.value.profile.os },
  { label: t('admin.stats.visitorDetail.locale'), value: detail.value.profile.locale },
  { label: t('admin.stats.visitorDetail.currency'), value: detail.value.profile.currency },
] : [])

const touchFields = (prefix: 'first' | 'last') => {
  const profile = detail.value?.profile
  if (!profile) return []
  const key = (suffix: string) => profile[`${prefix}${suffix}`]
  return [
    { label: t('admin.stats.visitorDetail.sourceType'), value: key('SourceType') },
    { label: t('admin.stats.source'), value: key('Source') },
    { label: t('admin.stats.visitorDetail.medium'), value: key('Medium') },
    { label: t('admin.stats.visitorDetail.campaign'), value: key('Campaign') },
    { label: t('admin.stats.visitorDetail.content'), value: key('Content') },
    { label: t('admin.stats.visitorDetail.term'), value: key('Term') },
    { label: t('admin.stats.path'), value: prefix === 'first' ? profile.firstPath || profile.landingPath : profile.lastPath },
    { label: t('admin.stats.referrer'), value: key('Referrer') },
  ]
}
const firstTouchFields = computed(() => touchFields('first'))
const lastTouchFields = computed(() => touchFields('last'))

const eventLabel = (eventName: string) => {
  const keys: Record<string, string> = { page_view: 'pageView', product_view: 'productView', begin_checkout: 'beginCheckout', order_paid: 'orderPaid', auth: 'login' }
  return keys[eventName] ? t(`admin.stats.${keys[eventName]}`) : eventName
}

const copy = async (text: string) => {
  if (!text) return
  await navigator.clipboard.writeText(text)
  toast.add({ title: t('admin.stats.visitorDetail.copied'), color: 'success' })
}
</script>
