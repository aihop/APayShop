<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-6xl' }">
    <template #content>
      <UCard class="max-h-[90vh] overflow-hidden bg-white ring-1 ring-gray-200 dark:bg-[#121214] dark:ring-gray-800">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <UIcon name="ph:globe-hemisphere-west" class="h-5 w-5 shrink-0 text-purple-500" />
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('admin.stats.ipDetail.title') }}</h3>
              </div>
              <button type="button" class="mt-1 font-mono text-xs text-gray-500 hover:text-purple-500" @click="copy(ipLabel)">{{ ipLabel }}</button>
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
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <div v-for="card in statCards" :key="card.label" class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-black/20">
                <div class="text-xs text-gray-500">{{ card.label }}</div>
                <div class="mt-1 text-lg font-semibold tabular-nums" :class="card.class">{{ card.value }}</div>
              </div>
            </div>

            <AdminStatsDetailSection :title="t('admin.stats.ipDetail.overview')" icon="ph:map-pin">
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStatsDetailField :label="t('admin.stats.ip')" :value="ipLabel" copyable @copy="copy" />
                <AdminStatsDetailField :label="t('admin.stats.firstSeen')" :value="formatDateTime(detail.stats.firstSeenAt)" />
                <AdminStatsDetailField :label="t('admin.stats.lastSeen')" :value="formatDateTime(detail.stats.lastSeenAt)" />
                <AdminStatsDetailField :label="t('admin.stats.ipDetail.observedContexts')" :value="detail.contexts.length" />
              </div>
              <div v-if="detail.contexts.length" class="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <UBadge v-for="(context, index) in detail.contexts" :key="index" color="neutral" variant="subtle">
                  {{ contextLabel(context) }} · {{ context.count }}
                </UBadge>
              </div>
            </AdminStatsDetailSection>

            <AdminStatsDetailSection :title="`${t('admin.stats.ipDetail.visitors')} (${detail.stats.uniqueVisitors})`" icon="ph:users-three">
              <p v-if="detail.stats.uniqueVisitors > detail.visitorLimit" class="mb-3 text-xs text-gray-500">
                {{ t('admin.stats.ipDetail.visitorLimit', { count: detail.visitorLimit }) }}
              </p>
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead><tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                    <th class="pb-2 pr-4">{{ t('admin.stats.visitor') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.ipDetail.account') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.visits') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.firstSource') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.device') }}</th>
                    <th class="pb-2 pr-4">{{ t('admin.stats.lastSeen') }}</th>
                    <th class="pb-2 text-right">{{ t('admin.stats.visitorDetail.actions') }}</th>
                  </tr></thead>
                  <tbody><tr v-for="visitor in detail.visitors" :key="visitor.visitorId" class="border-b border-gray-100 dark:border-gray-900">
                    <td class="py-2.5 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">{{ visitor.visitorId }}</td>
                    <td class="py-2.5 pr-4">
                      <span v-if="visitor.user" class="text-xs text-gray-700 dark:text-gray-300">{{ visitor.user.nickname || visitor.user.email }}</span>
                      <span v-else class="text-xs text-gray-500">{{ t('admin.stats.visitorDetail.anonymous') }}</span>
                    </td>
                    <td class="py-2.5 pr-4 tabular-nums">{{ visitor.eventCount }}</td>
                    <td class="py-2.5 pr-4 text-xs text-gray-500">{{ visitor.firstTouch }}</td>
                    <td class="py-2.5 pr-4 text-xs text-gray-500">{{ [visitor.deviceType, visitor.browser, visitor.os].filter(Boolean).join(' · ') || '-' }}</td>
                    <td class="py-2.5 pr-4 whitespace-nowrap text-xs text-gray-500">{{ formatDateTime(visitor.lastSeenAt) }}</td>
                    <td class="py-2.5 text-right"><UButton color="neutral" variant="ghost" icon="ph:eye" size="xs" :title="t('admin.stats.visitorDetail.view')" @click="$emit('view-visitor', visitor.visitorId)" /></td>
                  </tr></tbody>
                </table>
              </div>
            </AdminStatsDetailSection>

            <AdminStatsDetailSection :title="`${t('admin.stats.visitorDetail.timeline')} (${detail.stats.totalEvents})`" icon="ph:clock-counter-clockwise">
              <p v-if="detail.stats.totalEvents > detail.recentEventsLimit" class="mb-3 text-xs text-gray-500">
                {{ t('admin.stats.visitorDetail.timelineLimit', { count: detail.recentEventsLimit }) }}
              </p>
              <div class="space-y-3">
                <div v-for="item in detail.recentEvents" :key="item.id" class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <UBadge color="primary" variant="subtle" size="xs">{{ eventLabel(item.eventName) }}</UBadge>
                      <span class="font-mono text-[11px] text-gray-500">{{ item.visitorId }}</span>
                      <span v-if="item.productName" class="text-xs text-blue-500">{{ item.productName }}</span>
                    </div>
                    <span class="text-xs text-gray-500">{{ formatDateTime(item.createdAt) }}</span>
                  </div>
                  <div class="mt-2 grid gap-2 text-xs lg:grid-cols-2">
                    <div class="break-all font-mono text-gray-700 dark:text-gray-300">{{ item.path || '-' }}</div>
                    <div class="break-all text-gray-500">{{ item.referrer || '-' }}</div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>{{ [item.city, item.region, item.country].filter(Boolean).join(' / ') || '-' }}</span>
                    <span>{{ [item.deviceType, item.browser, item.os].filter(Boolean).join(' · ') || '-' }}</span>
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
const props = defineProps<{ open: boolean; ip: string | null; preset: string; days: number }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; 'view-visitor': [visitorId: string] }>()
const { t } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()

const isOpen = computed({ get: () => props.open, set: value => emit('update:open', value) })
const ipLabel = computed(() => props.ip || t('admin.stats.ipDetail.local'))
const detail = ref<any>(null)
const pending = ref(false)
const errorMessage = ref('')

const load = async () => {
  pending.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    detail.value = await $fetch('/api/admin/stats/ip-details', {
      query: { ip: props.ip || undefined, local: props.ip ? undefined : '1', preset: props.preset, days: props.days },
    })
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || t('admin.stats.ipDetail.loadError')
  } finally {
    pending.value = false
  }
}

watch(() => [props.open, props.ip, props.preset, props.days] as const, ([open]) => { if (open) load() })

const statCards = computed(() => detail.value ? [
  { label: t('admin.stats.visitorDetail.totalEvents'), value: detail.value.stats.totalEvents, class: 'text-gray-900 dark:text-white' },
  { label: t('admin.stats.ipDetail.uniqueVisitors'), value: detail.value.stats.uniqueVisitors, class: 'text-purple-500' },
  { label: t('admin.stats.ipDetail.registeredUsers'), value: detail.value.stats.registeredUsers, class: 'text-green-500' },
  { label: t('admin.stats.pageViews'), value: detail.value.stats.pageViews, class: 'text-cyan-500' },
  { label: t('admin.stats.productVisitors'), value: detail.value.stats.productViews, class: 'text-blue-500' },
  { label: t('admin.stats.checkout'), value: detail.value.stats.checkouts, class: 'text-amber-500' },
  { label: t('admin.stats.paid'), value: detail.value.stats.paid, class: 'text-emerald-500' },
  { label: 'Auth', value: detail.value.stats.auth, class: 'text-pink-500' },
] : [])

const contextLabel = (context: any) => [
  [context.city, context.region, context.country].filter(Boolean).join('/'),
  [context.deviceType, context.browser, context.os].filter(Boolean).join(' · '),
].filter(Boolean).join(' — ') || '-'

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
