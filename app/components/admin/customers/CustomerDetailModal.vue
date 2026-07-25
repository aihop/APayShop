<template>
  <FullScreenModal
    v-model="isOpen"
    :title="modalTitle"
    maxWidth="sm:max-w-4xl"
    :defaultFullscreen="false"
  >
    <div
      v-if="pending"
      class="py-16 flex items-center justify-center text-gray-400"
    >
      <UIcon
        name="ph:spinner-gap-bold"
        class="w-6 h-6 animate-spin"
      />
    </div>

    <div
      v-else-if="detail"
      class="space-y-6"
    >
      <!-- Identity -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <UIcon
              :name="detail.identity.isAnonymous ? 'ph:ghost' : 'ph:user-circle-fill'"
              class="w-5 h-5 text-purple-500"
            />
            <span class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ detail.identity.email || anonymousLabel }}
            </span>
          </div>
          <div
            v-if="detail.identity.visitorId"
            class="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary-400"
            :title="copyHint"
            @click="copyToClipboard(detail.identity.visitorId)"
          >
            {{ visitorIdLabel }}: {{ detail.identity.visitorId }}
          </div>
        </div>

        <div
          v-if="detail.registeredUser"
          class="flex items-center gap-2 rounded-xl border border-purple-200/60 bg-purple-50/60 px-3 py-2 text-xs dark:border-purple-500/20 dark:bg-purple-500/10"
        >
          <UIcon
            name="ph:shield-check"
            class="w-4 h-4 text-purple-500 shrink-0"
          />
          <span class="text-purple-700 dark:text-purple-300">{{ hasAccountLabel }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            @click="$emit('view-user', detail.registeredUser.id)"
          >{{ viewAccountLabel }}</UButton>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="rounded-xl border border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20 px-4 py-3"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ card.label }}</div>
          <div
            class="mt-1 text-lg font-semibold"
            :class="card.class || 'text-gray-900 dark:text-white'"
          >{{ card.value }}</div>
        </div>
      </div>

      <!-- Attribution / device -->
      <div
        v-if="detail.profile"
        class="rounded-xl border border-gray-200 dark:border-gray-800/60 overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ attributionTitle }}</h4>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 p-4 text-sm">
          <div
            v-for="field in attributionFields"
            :key="field.label"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ field.label }}</div>
            <div class="text-gray-900 dark:text-white truncate">{{ field.value || '-' }}</div>
          </div>
        </div>
      </div>

      <!-- Orders -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-800/60 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ ordersTitle }} ({{ detail.orders.length }})</h4>
        </div>
        <div
          v-if="!detail.orders.length"
          class="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >{{ noOrdersLabel }}</div>
        <div
          v-else
          class="divide-y divide-gray-200 dark:divide-gray-800/60 max-h-80 overflow-auto"
        >
          <div
            v-for="order in detail.orders"
            :key="order.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div class="min-w-0 flex-1">
              <div class="text-gray-900 dark:text-white truncate">{{ order.productName || unknownProductLabel }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{{ order.id }}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-gray-900 dark:text-white">${{ Number(order.amount || 0).toFixed(2) }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(order.createdAt) }}</div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0 w-24">
              <UBadge
                :color="payStatusColor(order.payStatus)"
                variant="subtle"
                size="sm"
              >{{ order.payStatus }}</UBadge>
              <UBadge
                :color="statusColor(order.status)"
                variant="subtle"
                size="sm"
              >{{ order.status }}</UBadge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="py-16 text-center text-sm text-gray-500 dark:text-gray-400"
    >{{ loadErrorLabel }}</div>
  </FullScreenModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  email?: string | null
  visitorId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'view-user': [userId: number]
}>()

const { locale } = useI18n()
const { formatDateTime } = useFormatTime()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isZh = computed(() => locale.value.startsWith('zh'))

const anonymousLabel = computed(() => (isZh.value ? '匿名访客' : 'Anonymous Visitor'))
const visitorIdLabel = computed(() => (isZh.value ? '访客 ID' : 'Visitor ID'))
const copyHint = computed(() => (isZh.value ? '点击复制' : 'Click to copy'))
const hasAccountLabel = computed(() => (isZh.value ? '已注册账号' : 'Has a registered account'))
const viewAccountLabel = computed(() => (isZh.value ? '查看账号' : 'View account'))
const attributionTitle = computed(() => (isZh.value ? '来源与设备' : 'Attribution & Device'))
const ordersTitle = computed(() => (isZh.value ? '订单记录' : 'Order History'))
const noOrdersLabel = computed(() => (isZh.value ? '暂无订单' : 'No orders yet'))
const unknownProductLabel = computed(() => (isZh.value ? '未知商品' : 'Unknown product'))
const loadErrorLabel = computed(() => (isZh.value ? '加载详情失败' : 'Failed to load detail'))

const modalTitle = computed(() => detail.value?.identity?.email || anonymousLabel.value)

const detail = ref<any>(null)
const pending = ref(false)

const load = async () => {
  if (!props.email && !props.visitorId) return
  pending.value = true
  detail.value = null
  try {
    detail.value = await $fetch('/api/admin/customers/detail', {
      query: {
        email: props.email && props.email !== 'Anonymous' ? props.email : '',
        visitorId: props.visitorId || '',
      },
    })
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || loadErrorLabel.value,
      color: 'error',
    })
  } finally {
    pending.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) load()
})

const statCards = computed(() => {
  if (!detail.value) return []
  const s = detail.value.stats
  return [
    { label: isZh.value ? '订单总数' : 'Total Orders', value: s.totalOrders },
    { label: isZh.value ? '消费总额' : 'Total Spent', value: `$${Number(s.totalSpent || 0).toFixed(2)}`, class: 'text-emerald-500' },
    { label: isZh.value ? '未支付' : 'Unpaid', value: s.unpaidOrders, class: s.unpaidOrders > 0 ? 'text-red-500' : undefined },
    {
      label: isZh.value ? '最近下单' : 'Last Order',
      value: detail.value.orders[0] ? formatDateTime(detail.value.orders[0].createdAt) : '-',
    },
  ]
})

const attributionFields = computed(() => {
  const p = detail.value?.profile
  if (!p) return []
  const loc = [p.city, p.region, p.country].filter(Boolean).join(' / ') || '-'
  return [
    { label: isZh.value ? '来源渠道' : 'Source', value: p.firstSource || p.lastSource },
    { label: isZh.value ? '媒介' : 'Medium', value: p.firstMedium || p.lastMedium },
    { label: isZh.value ? '活动' : 'Campaign', value: p.firstCampaign || p.lastCampaign },
    { label: isZh.value ? '首次来源页' : 'Referrer', value: p.firstReferrer || p.lastReferrer },
    { label: isZh.value ? '地理位置' : 'Location', value: loc },
    { label: isZh.value ? '语言' : 'Locale', value: p.locale },
    { label: isZh.value ? '设备' : 'Device', value: p.deviceType },
    { label: isZh.value ? '浏览器' : 'Browser', value: p.browser },
    { label: isZh.value ? '操作系统' : 'OS', value: p.os },
    { label: isZh.value ? '首次到访' : 'First Seen', value: formatDateTime(p.firstSeenAt) },
    { label: isZh.value ? '最近到访' : 'Last Seen', value: formatDateTime(p.lastSeenAt) },
  ]
})

const payStatusColor = (status: string): any => {
  switch (status) {
    case 'paid': return 'success'
    case 'failed': return 'error'
    case 'refunded': return 'info'
    default: return 'neutral'
  }
}

const statusColor = (status: string): any => {
  switch (status) {
    case 'delivered':
    case 'completed':
    case 'active':
      return 'success'
    case 'expired':
    case 'failed':
      return 'error'
    case 'processing':
      return 'warning'
    default:
      return 'neutral'
  }
}

const copyToClipboard = (text: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({
    title: isZh.value ? '已复制' : 'Copied',
    color: 'success',
  })
}
</script>
