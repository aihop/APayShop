<template>
  <FullScreenModal
    v-model="isOpen"
    maxWidth="sm:max-w-3xl"
    :default-fullscreen="false"
    :title="$t('admin.orders.manualOrder.title')"
  >
    <!-- Result View after creation -->
    <div
      v-if="createdResult"
      class="space-y-6 py-4"
    >
      <div class="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-5">
        <div class="flex items-start gap-4">
          <div class="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full text-emerald-600 dark:text-emerald-400 shrink-0">
            <UIcon
              name="ph:check-circle-fill"
              class="w-6 h-6"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-base font-semibold text-emerald-900 dark:text-emerald-200">
              {{ $t('admin.orders.manualOrder.successTitle') }}
            </h4>
            <p class="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {{ $t('admin.orders.modal.order_id') }}: {{ createdResult.id }}
            </p>
            <p class="text-sm text-emerald-800 dark:text-emerald-300 mt-2">
              <span v-if="createdResult.order?.payStatus === 'pending'">
                {{ $t('admin.orders.manualOrder.pendingLinkNotice') }}
              </span>
              <span v-else>
                {{ $t('admin.orders.manualOrder.paidNotice') }}
              </span>
            </p>
          </div>
        </div>
      </div>

      <!-- Payment link box for pending orders -->
      <div
        v-if="createdResult.order?.payStatus === 'pending' && createdResult.paymentUrl"
        class="p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-[#18181b] space-y-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ $t('admin.orders.modal.payment_link') }}
          </span>
          <UBadge
            color="warning"
            variant="subtle"
            size="xs"
          >
            {{ $t('admin.orders.pay_status_pending') }}
          </UBadge>
        </div>
        <div class="p-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700/60 rounded-lg text-xs font-mono text-gray-900 dark:text-gray-200 break-all select-all">
          {{ createdResult.paymentUrl }}
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <UButton
            color="primary"
            variant="solid"
            icon="ph:copy"
            @click="copyPaymentUrl(createdResult.paymentUrl)"
          >
            {{ $t('admin.orders.manualOrder.copyLink') }}
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="ph:arrow-square-out"
            :to="createdResult.paymentUrl"
            target="_blank"
          >
            {{ $t('admin.orders.manualOrder.openPaymentPage') }}
          </UButton>
        </div>
      </div>

      <div class="flex justify-end pt-4">
        <UButton
          color="primary"
          @click="handleDone"
        >
          {{ $t('admin.orders.manualOrder.close') }}
        </UButton>
      </div>
    </div>

    <!-- Order Creation Form -->
    <form
      v-else
      @submit.prevent="handleSubmit"
      class="space-y-6"
    >
      <!-- Section 1: Customer Info -->
      <div class="p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#161618] space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon
              name="ph:user-circle"
              class="w-4 h-4 text-primary-500"
            />
            {{ $t('admin.orders.manualOrder.userSection') }}
          </h4>

          <div class="flex bg-gray-100 dark:bg-gray-800/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-colors"
              :class="userMode === 'select' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              @click="userMode = 'select'"
            >
              {{ $t('admin.orders.manualOrder.userModeSelect') }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md transition-colors"
              :class="userMode === 'create' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              @click="userMode = 'create'"
            >
              {{ $t('admin.orders.manualOrder.userModeCreate') }}
            </button>
          </div>
        </div>

        <!-- Mode: Select Existing User -->
        <div
          v-if="userMode === 'select'"
          class="space-y-3"
        >
          <UFormField :label="$t('admin.orders.manualOrder.searchUser')">
            <div class="relative">
              <UInput
                v-model="userQuery"
                :placeholder="$t('admin.orders.manualOrder.searchUser')"
                icon="ph:magnifying-glass"
                class="w-full"
                @input="handleUserSearchInput"
              />
              <div
                v-if="isSearchingUsers"
                class="absolute right-3 top-2.5 text-xs text-gray-400"
              >
                {{ $t('admin.orders.manualOrder.searching') }}
              </div>
            </div>
          </UFormField>

          <!-- Search results dropdown / list -->
          <div
            v-if="userSearchResults.length > 0"
            class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 bg-gray-50 dark:bg-gray-900/40"
          >
            <div
              v-for="user in userSearchResults"
              :key="user.id"
              class="p-2.5 flex items-center justify-between cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors"
              :class="selectedUser?.id === user.id ? 'bg-primary-50 dark:bg-primary-950/30' : ''"
              @click="selectUser(user)"
            >
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                  <UIcon
                    name="ph:user"
                    class="w-3.5 h-3.5 text-primary-500 shrink-0"
                  />
                  {{ user.email }}
                </span>
                <span
                  v-if="user.nickname"
                  class="text-[11px] text-gray-500 truncate"
                >
                  {{ user.nickname }} (ID: {{ user.id }})
                </span>
              </div>
              <UButton
                size="xs"
                :color="selectedUser?.id === user.id ? 'primary' : 'neutral'"
                :variant="selectedUser?.id === user.id ? 'solid' : 'ghost'"
              >
                {{ selectedUser?.id === user.id ? '✓' : '+' }}
              </UButton>
            </div>
          </div>

          <!-- Selected user badge display -->
          <div
            v-if="selectedUser"
            class="flex items-center justify-between p-3 rounded-lg border border-primary-200 dark:border-primary-800/60 bg-primary-50/60 dark:bg-primary-950/20"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="ph:check-circle-fill"
                class="w-4 h-4 text-primary-600 dark:text-primary-400"
              />
              <span class="text-xs font-medium text-gray-900 dark:text-white">
                {{ selectedUser.email }}
              </span>
              <span
                v-if="selectedUser.nickname"
                class="text-xs text-gray-500"
              >
                ({{ selectedUser.nickname }})
              </span>
            </div>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="ph:x"
              @click="selectedUser = null"
            />
          </div>
        </div>

        <!-- Mode: Create New User / Direct Email -->
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <UFormField
            :label="$t('admin.orders.manualOrder.email')"
            required
          >
            <UInput
              v-model="customerEmail"
              type="email"
              required
              :placeholder="$t('admin.orders.manualOrder.emailPlaceholder')"
              class="w-full"
            />
            <p class="text-[11px] text-gray-500 mt-1">
              {{ $t('admin.orders.manualOrder.emailHelp') }}
            </p>
          </UFormField>
          <UFormField :label="$t('admin.orders.manualOrder.nickname')">
            <UInput
              v-model="customerNickname"
              :placeholder="$t('admin.orders.manualOrder.nicknamePlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>

      <!-- Section 2: Product & Amount -->
      <div class="p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#161618] space-y-4">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-3">
          <UIcon
            name="ph:package"
            class="w-4 h-4 text-primary-500"
          />
          {{ $t('admin.orders.manualOrder.productSection') }}
        </h4>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <UFormField
              :label="$t('admin.orders.manualOrder.selectProduct')"
              required
            >
              <USelect
                v-model="selectedProductId"
                :items="productOptions"
                :placeholder="$t('admin.orders.manualOrder.selectProductPlaceholder')"
                class="w-full"
                @update:model-value="handleProductChange"
              />
            </UFormField>
          </div>

          <div>
            <UFormField
              :label="$t('admin.orders.manualOrder.quantity')"
              required
            >
              <UInput
                v-model.number="quantity"
                type="number"
                min="1"
                step="1"
                required
                class="w-full"
                @input="handleQuantityChange"
              />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <UFormField
            :label="$t('admin.orders.manualOrder.customAmount')"
            required
          >
            <UInput
              v-model.number="actualAmount"
              type="number"
              min="0"
              step="0.01"
              required
              class="w-full"
            />
            <p class="text-[11px] text-gray-500 mt-1">
              {{ $t('admin.orders.manualOrder.customAmountHelp') }}
            </p>
          </UFormField>

          <UFormField :label="$t('admin.orders.manualOrder.currency')">
            <USelect
              v-model="currency"
              :items="currencyOptions"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>

      <!-- Section 3: Payment & Fulfillment Settings -->
      <div class="p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#161618] space-y-4">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-3">
          <UIcon
            name="ph:credit-card"
            class="w-4 h-4 text-primary-500"
          />
          {{ $t('admin.orders.manualOrder.paymentSection') }}
        </h4>

        <!-- Pay Status Radio -->
        <UFormField :label="$t('admin.orders.manualOrder.payMode')">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              class="p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3"
              :class="payStatus === 'paid' ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-950/20 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'"
              @click="payStatus = 'paid'"
            >
              <div
                class="w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0"
                :class="payStatus === 'paid' ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'"
              >
                <div
                  v-if="payStatus === 'paid'"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-gray-900 dark:text-white">
                  {{ $t('admin.orders.manualOrder.payModePaid') }}
                </span>
                <span class="text-[11px] text-gray-500 mt-0.5">
                  已在线下或外部收款，直接标记已付并可立即开通服务。
                </span>
              </div>
            </div>

            <div
              class="p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3"
              :class="payStatus === 'pending' ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-950/20 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'"
              @click="payStatus = 'pending'"
            >
              <div
                class="w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0"
                :class="payStatus === 'pending' ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'"
              >
                <div
                  v-if="payStatus === 'pending'"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold text-gray-900 dark:text-white">
                  {{ $t('admin.orders.manualOrder.payModePending') }}
                </span>
                <span class="text-[11px] text-gray-500 mt-0.5">
                  生成待付款订单与专属支付链接，发给客户自行付款。
                </span>
              </div>
            </div>
          </div>
        </UFormField>

        <!-- Paid Details Settings -->
        <div
          v-if="payStatus === 'paid'"
          class="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800/80"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField :label="$t('admin.orders.manualOrder.payMethod')">
              <USelect
                v-model="payMethod"
                :items="payMethodOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField :label="$t('admin.orders.manualOrder.tradeNo')">
              <UInput
                v-model="tradeNo"
                :placeholder="$t('admin.orders.manualOrder.tradeNoPlaceholder')"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="pt-1">
            <UCheckbox
              v-model="autoFulfill"
              :label="$t('admin.orders.manualOrder.autoFulfill')"
              :description="$t('admin.orders.manualOrder.autoFulfillHelp')"
            />
          </div>

          <UFormField :label="$t('admin.orders.manualOrder.deliveryInfo')">
            <UTextarea
              v-model="deliveryInfo"
              :rows="2"
              :placeholder="$t('admin.orders.manualOrder.deliveryInfoPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="pt-2 border-t border-gray-100 dark:border-gray-800/80">
          <UCheckbox
            v-model="sendEmail"
            :label="$t('admin.orders.manualOrder.sendEmail')"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        >
          {{ $t('admin.common.cancel') }}
        </UButton>
        <UButton
          type="submit"
          color="primary"
          :loading="isSubmitting"
        >
          {{ $t('admin.orders.manualOrder.submit') }}
        </UButton>
      </div>
    </form>
  </FullScreenModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast, useI18n, useRequestURL } from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [order: any]
}>()

const { t } = useI18n()
const toast = useToast()
const requestUrl = useRequestURL()
const { getSetting, fetchSettings } = useSettings()
const { baseCurrency } = useLocaleCurrency()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// Form State
const userMode = ref<'select' | 'create'>('select')
const userQuery = ref('')
const isSearchingUsers = ref(false)
const userSearchResults = ref<any[]>([])
const selectedUser = ref<any>(null)

const customerEmail = ref('')
const customerNickname = ref('')

const productsList = ref<any[]>([])
const selectedProductId = ref<string | number | undefined>(undefined)
const quantity = ref(1)
const actualAmount = ref<number>(0)
const currency = ref(baseCurrency.value || 'CNY')

const payStatus = ref<'paid' | 'pending'>('paid')
const payMethod = ref('manual')
const tradeNo = ref('')
const autoFulfill = ref(true)
const deliveryInfo = ref('')
const sendEmail = ref(false)

const isSubmitting = ref(false)
const createdResult = ref<{ id: string; order: any; paymentUrl: string } | null>(null)

// Options
const payMethodOptions = computed(() => [
  { value: 'manual', label: t('admin.orders.manualOrder.payMethodManual') },
  { value: 'bank_transfer', label: t('admin.orders.manualOrder.payMethodBank') },
  { value: 'alipay', label: t('admin.orders.manualOrder.payMethodAlipay') },
  { value: 'wechat', label: t('admin.orders.manualOrder.payMethodWechat') },
  { value: 'stripe', label: t('admin.orders.manualOrder.payMethodStripe') },
  { value: 'crypto', label: t('admin.orders.manualOrder.payMethodCrypto') },
  { value: 'cash', label: t('admin.orders.manualOrder.payMethodCash') },
])

const currencyOptions = [
  { value: 'CNY', label: 'CNY (人民币 ¥)' },
  { value: 'USD', label: 'USD (美元 $)' },
  { value: 'EUR', label: 'EUR (欧元 €)' },
  { value: 'HKD', label: 'HKD (港币 HK$)' },
  { value: 'JPY', label: 'JPY (日元 ¥)' },
]

const productOptions = computed(() =>
  productsList.value.map(p => ({
    value: p.id,
    label: `${p.name} — ${p.price} ${currency.value || 'USD'} (${p.type || 'basic'})`,
  }))
)

// Fetch Products on open
const fetchProducts = async () => {
  try {
    const res: any = await $fetch('/api/admin/products', {
      query: { page: 1, pageSize: 100 },
    })
    productsList.value = (res?.data || []).filter((p: any) => p.isActive !== false)
    if (productsList.value.length > 0 && !selectedProductId.value) {
      selectedProductId.value = productsList.value[0].id
      handleProductChange(selectedProductId.value)
    }
  } catch (err) {
    console.error('Failed to load products:', err)
  }
}

// User Search Debounce
let searchTimer: any = null
const handleUserSearchInput = () => {
  clearTimeout(searchTimer)
  const q = userQuery.value.trim()
  if (!q) {
    userSearchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    isSearchingUsers.value = true
    try {
      const res: any = await $fetch('/api/admin/users', {
        query: { q, page: 1, pageSize: 10 },
      })
      userSearchResults.value = res?.data || []
    } catch (e) {
      userSearchResults.value = []
    } finally {
      isSearchingUsers.value = false
    }
  }, 300)
}

const selectUser = (user: any) => {
  selectedUser.value = user
  userSearchResults.value = []
  userQuery.value = ''
}

const handleProductChange = (productId: string | number | undefined) => {
  if (!productId) return
  const prod = productsList.value.find(p => p.id === Number(productId))
  if (prod) {
    actualAmount.value = Number((Number(prod.price || 0) * (quantity.value || 1)).toFixed(2))
  }
}

const handleQuantityChange = () => {
  const q = Math.max(1, quantity.value || 1)
  const prod = productsList.value.find(p => p.id === Number(selectedProductId.value))
  if (prod) {
    actualAmount.value = Number((Number(prod.price || 0) * q).toFixed(2))
  }
}

// Reset form
const resetForm = () => {
  userMode.value = 'select'
  userQuery.value = ''
  userSearchResults.value = []
  selectedUser.value = null
  customerEmail.value = ''
  customerNickname.value = ''
  quantity.value = 1
  currency.value = baseCurrency.value || getSetting('currency', 'USD') || 'CNY'
  payStatus.value = 'paid'
  payMethod.value = 'manual'
  tradeNo.value = ''
  autoFulfill.value = true
  deliveryInfo.value = ''
  sendEmail.value = false
  isSubmitting.value = false
  createdResult.value = null
  if (productsList.value.length > 0) {
    selectedProductId.value = productsList.value[0].id
    handleProductChange(selectedProductId.value)
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await fetchSettings()
      currency.value = baseCurrency.value || getSetting('currency', 'USD') || 'CNY'
      resetForm()
      await fetchProducts()
    }
  }
)

// Copy helper
const copyPaymentUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    toast.add({
      title: t('admin.orders.toast.copied'),
      description: t('admin.orders.toast.payment_link_copied'),
      color: 'success',
    })
  } catch (e) {
    toast.add({
      title: t('admin.orders.toast.error'),
      description: 'Copy failed',
      color: 'error',
    })
  }
}

const handleDone = () => {
  isOpen.value = false
  emit('success', createdResult.value?.order)
}

const handleSubmit = async () => {
  // 1. Validation
  let finalEmail = ''
  let finalUserId: number | undefined = undefined

  if (userMode.value === 'select') {
    if (!selectedUser.value) {
      toast.add({
        title: t('admin.orders.toast.error'),
        description: t('admin.orders.manualOrder.validation.emailRequired'),
        color: 'error',
      })
      return
    }
    finalUserId = selectedUser.value.id
    finalEmail = selectedUser.value.email
  } else {
    finalEmail = customerEmail.value.trim()
    if (!finalEmail || !finalEmail.includes('@')) {
      toast.add({
        title: t('admin.orders.toast.error'),
        description: t('admin.orders.manualOrder.validation.emailRequired'),
        color: 'error',
      })
      return
    }
  }

  if (!selectedProductId.value) {
    toast.add({
      title: t('admin.orders.toast.error'),
      description: t('admin.orders.manualOrder.validation.productRequired'),
      color: 'error',
    })
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      userId: finalUserId,
      email: finalEmail,
      nickname: customerNickname.value.trim() || undefined,
      productId: Number(selectedProductId.value),
      quantity: Math.max(1, quantity.value || 1),
      amount: Number(actualAmount.value || 0),
      currency: currency.value,
      payStatus: payStatus.value,
      payMethod: payStatus.value === 'paid' ? payMethod.value : 'none',
      tradeNo: tradeNo.value.trim() || undefined,
      autoFulfill: autoFulfill.value,
      deliveryInfo: deliveryInfo.value.trim() || undefined,
      sendEmail: sendEmail.value,
    }

    const res: any = await $fetch('/api/admin/orders', {
      method: 'POST',
      body: payload,
    })

    if (res?.data) {
      createdResult.value = res.data
      toast.add({
        title: t('admin.orders.toast.success'),
        description: t('admin.orders.manualOrder.successTitle'),
        color: 'success',
      })
      emit('success', res.data.order)
    }
  } catch (err: any) {
    toast.add({
      title: t('admin.orders.toast.error'),
      description: err.data?.message || err.message || 'Create order failed',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>
