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
        <div class="flex items-center gap-3">
          <img
            v-if="detail.user.avatarUrl"
            :src="detail.user.avatarUrl"
            class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-800"
          />
          <div
            v-else
            class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"
          >
            <UIcon name="ph:user" class="w-5 h-5" />
          </div>
          <div>
            <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ detail.user.nickname || detail.user.email }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ detail.user.email }} · ID {{ detail.user.id }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            :color="detail.user.status === 1 ? 'success' : 'error'"
            variant="subtle"
          >{{ detail.user.status === 1 ? activeLabel : disabledLabel }}</UBadge>
          <UBadge
            v-if="detail.user.emailVerifiedAt"
            color="info"
            variant="subtle"
          >{{ verifiedLabel }}</UBadge>
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

      <!-- Balances (only shown if the site actually uses them) -->
      <div
        v-if="hasBalances"
        class="rounded-xl border border-gray-200 dark:border-gray-800/60 overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ balancesTitle }}</h4>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 text-sm">
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ cashBalanceLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ formatCurrencyAmount(detail.user.cashBalance, baseCurrency) }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ grantBalanceLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ formatCurrencyAmount(detail.user.grantBalance, baseCurrency) }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ subBalanceLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ formatCurrencyAmount(detail.user.subBalance, baseCurrency) }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ tierLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ detail.user.tierLevel ?? '-' }}</div>
          </div>
        </div>
      </div>

      <!-- Account meta -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-800/60 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ accountTitle }}</h4>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 p-4 text-sm">
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ registeredAtLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ formatDateTime(detail.user.createdAt) }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ lastLoginLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ detail.user.lastLoginAt ? formatDateTime(detail.user.lastLoginAt) : '-' }}</div>
          </div>
          <div v-if="detail.oauthAccounts.length">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ oauthLabel }}</div>
            <div class="flex flex-wrap gap-1 mt-0.5">
              <UBadge
                v-for="acc in detail.oauthAccounts"
                :key="acc.provider"
                color="neutral"
                variant="subtle"
                size="sm"
                class="capitalize"
              >{{ acc.provider }}</UBadge>
            </div>
          </div>
          <div v-if="detail.promoMember">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ promoLabel }}</div>
            <div class="text-gray-900 dark:text-white capitalize">{{ detail.promoMember.role }} · {{ detail.promoMember.promoCode }}</div>
          </div>
          <div v-if="detail.tokens.length">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ tokensLabel }}</div>
            <div class="text-gray-900 dark:text-white">{{ activeTokenCount }} / {{ detail.tokens.length }} {{ activeLabelShort }}</div>
          </div>
        </div>
      </div>

      <!-- Attribution -->
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

      <!-- Subscriptions -->
      <div
        v-if="detail.subscriptions.length"
        class="rounded-xl border border-gray-200 dark:border-gray-800/60 overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ subscriptionsTitle }} ({{ detail.subscriptions.length }})</h4>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-800/60">
          <div
            v-for="sub in detail.subscriptions"
            :key="sub.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div class="min-w-0 flex-1 text-gray-900 dark:text-white truncate">{{ sub.productName || unknownProductLabel }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 shrink-0">
              {{ formatCurrencyAmount(sub.amount, sub.currency) }} / {{ sub.interval }}
            </div>
            <UBadge
              :color="sub.status === 'active' ? 'success' : sub.status === 'past_due' ? 'warning' : 'neutral'"
              variant="subtle"
              size="sm"
              class="shrink-0"
            >{{ sub.status }}</UBadge>
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
              <div class="text-gray-900 dark:text-white">{{ formatCurrencyAmount(order.amount, order.currency) }}</div>
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
  userId?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { locale } = useI18n()
const { formatDateTime } = useFormatTime()
const { formatCurrencyAmount, formatCurrencyTotals } = useCurrencyFormat()
const { getSetting, fetchSettings } = useSettings()
const toast = useToast()

void fetchSettings()
const baseCurrency = computed(() => getSetting('currency', 'USD'))

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isZh = computed(() => locale.value.startsWith('zh'))

const activeLabel = computed(() => (isZh.value ? '正常' : 'Active'))
const activeLabelShort = computed(() => (isZh.value ? '有效' : 'active'))
const disabledLabel = computed(() => (isZh.value ? '已禁用' : 'Disabled'))
const verifiedLabel = computed(() => (isZh.value ? '邮箱已验证' : 'Email Verified'))
const balancesTitle = computed(() => (isZh.value ? '账户余额' : 'Balances'))
const cashBalanceLabel = computed(() => (isZh.value ? '充值余额' : 'Cash Balance'))
const grantBalanceLabel = computed(() => (isZh.value ? '赠送余额' : 'Grant Balance'))
const subBalanceLabel = computed(() => (isZh.value ? '订阅余额' : 'Subscription Balance'))
const tierLabel = computed(() => (isZh.value ? '订阅等级' : 'Tier Level'))
const accountTitle = computed(() => (isZh.value ? '账户信息' : 'Account'))
const registeredAtLabel = computed(() => (isZh.value ? '注册时间' : 'Registered At'))
const lastLoginLabel = computed(() => (isZh.value ? '最近登录' : 'Last Login'))
const oauthLabel = computed(() => (isZh.value ? '第三方登录' : 'OAuth Accounts'))
const promoLabel = computed(() => (isZh.value ? '推广身份' : 'Promo Membership'))
const tokensLabel = computed(() => (isZh.value ? 'API 令牌' : 'API Tokens'))
const attributionTitle = computed(() => (isZh.value ? '来源与设备' : 'Attribution & Device'))
const subscriptionsTitle = computed(() => (isZh.value ? '订阅记录' : 'Subscriptions'))
const ordersTitle = computed(() => (isZh.value ? '订单记录' : 'Order History'))
const noOrdersLabel = computed(() => (isZh.value ? '暂无订单' : 'No orders yet'))
const unknownProductLabel = computed(() => (isZh.value ? '未知商品' : 'Unknown product'))
const loadErrorLabel = computed(() => (isZh.value ? '加载详情失败' : 'Failed to load detail'))

const modalTitle = computed(() => detail.value?.user?.nickname || detail.value?.user?.email || '')

const detail = ref<any>(null)
const pending = ref(false)

const load = async () => {
  if (!props.userId) return
  pending.value = true
  detail.value = null
  try {
    detail.value = await $fetch(`/api/admin/users/${props.userId}`)
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

watch(() => [props.modelValue, props.userId], ([open]) => {
  if (open) load()
})

const hasBalances = computed(() => {
  const u = detail.value?.user
  if (!u) return false
  return Number(u.cashBalance) !== 0 || Number(u.grantBalance) !== 0 || Number(u.subBalance) !== 0 || Number(u.tierLevel) > 0
})

const activeTokenCount = computed(() => (detail.value?.tokens || []).filter((t: any) => !t.revoked).length)

const statCards = computed(() => {
  if (!detail.value) return []
  const s = detail.value.stats
  return [
    { label: isZh.value ? '订单总数' : 'Total Orders', value: s.totalOrders },
    { label: isZh.value ? '消费总额' : 'Total Spent', value: formatCurrencyTotals(s.totalSpentByCurrency), class: 'text-emerald-500' },
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
</script>
