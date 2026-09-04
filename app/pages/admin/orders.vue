<template>
  <div class="h-[calc(100vh-7rem)] flex flex-col">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ activeTab === 'topups' ? $t('admin.topups.title', '充值记录') : $t('admin.orders.title', '订单管理') }}</h1>
      </div>

      <!-- 顶层分段 Tabs -->
      <div class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl shrink-0">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
          :class="activeTab === 'orders'
            ? 'bg-white dark:bg-[#1a1a1e] text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
          @click="switchTab('orders')"
        >
          <UIcon name="ph:shopping-cart-bold" class="h-3.5 w-3.5" />
          <span>{{ $t('admin.orders.tab_orders', '商品订单') }}</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
          :class="activeTab === 'topups'
            ? 'bg-white dark:bg-[#1a1a1e] text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
          @click="switchTab('topups')"
        >
          <UIcon name="ph:wallet-bold" class="h-3.5 w-3.5" />
          <span>{{ $t('admin.orders.tab_topups', '充值记录') }}</span>
        </button>
      </div>
    </div>

    <!-- 充值记录视图 -->
    <template v-if="activeTab === 'topups'">
      <AdminTopupRecordsPanel />
    </template>

    <!-- 商品订单视图 -->
    <template v-else>
      <!-- 第一行：状态胶囊 + 右侧操作 -->
      <div class="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <!-- 支付状态胶囊与回收站 -->
        <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          <button
            v-for="pill in payStatusPills"
            :key="pill.value"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer select-none"
            :class="activePayStatus === pill.value
              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30 font-semibold shadow-xs'
              : 'bg-white dark:bg-[#121214] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200/70 dark:border-gray-800/70 hover:border-gray-300 dark:hover:border-gray-700'"
            @click="selectPayStatus(pill.value)"
          >
            <span
              v-if="pill.dotColor"
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="pill.dotColor"
            />
            <span>{{ pill.label }}</span>
            <span
              v-if="pill.count !== undefined"
              class="px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none"
              :class="activePayStatus === pill.value
                ? 'bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'"
            >
              {{ pill.count }}
            </span>
          </button>

          <!-- Subtle Divider -->
          <div class="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1 shrink-0" />

          <!-- Dedicated Deleted Orders Tab -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer select-none"
            :class="activePayStatus === 'deleted'
              ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-red-500/30 font-semibold shadow-xs'
              : 'bg-white dark:bg-[#121214] text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200/70 dark:border-gray-800/70 hover:border-gray-300 dark:hover:border-gray-700'"
            @click="selectPayStatus('deleted')"
          >
            <UIcon
              name="ph:trash"
              class="w-3.5 h-3.5 shrink-0"
              :class="activePayStatus === 'deleted' ? 'text-red-500' : 'text-gray-400'"
            />
            <span>{{ $t('admin.orders.pay_status_deleted') }}</span>
            <span
              class="px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none"
              :class="activePayStatus === 'deleted'
                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'"
            >
              {{ stats.deleted }}
            </span>
          </button>
        </div>

        <!-- 刷新与手工建单 -->
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            color="neutral"
            variant="outline"
            icon="ph:arrows-clockwise"
            size="sm"
            :loading="pending"
            class="hover:bg-gray-50 dark:hover:bg-gray-800"
            @click="() => refresh()"
          />
          <UButton
            v-if="hasAdminPerm('orders:edit')"
            color="primary"
            icon="ph:plus-bold"
            size="sm"
            class="shadow-xs font-medium"
            @click="isManualOrderOpen = true"
          >
            {{ $t('admin.orders.createOrder') }}
          </UButton>
        </div>
      </div>

      <!-- 第二行：履约筛选 + 精简搜索框 + 订单统计 -->
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-2.5">
          <!-- Fulfillment Select Filter -->
          <USelect
            v-model="activeFulfillmentStatus"
            :items="fulfillmentFilterOptions"
            class="w-36 text-xs shrink-0"
            size="sm"
            @update:model-value="() => { page = 1 }"
          />

          <!-- Keyword Search Input -->
          <div class="relative w-64">
            <UInput
              v-model="searchInput"
              icon="ph:magnifying-glass"
              :placeholder="$t('admin.orders.search', '搜索单号、邮箱、商品...')"
              size="sm"
              class="w-full text-xs"
            >
              <template
                v-if="searchInput"
                #trailing
              >
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  @click="searchInput = ''"
                >
                  <UIcon
                    name="ph:x-circle-fill"
                    class="w-3.5 h-3.5"
                  />
                </button>
              </template>
            </UInput>
          </div>

          <!-- Reset Button -->
          <UButton
            v-if="isFiltered"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:arrow-counter-clockwise"
            :title="$t('admin.orders.reset_filters')"
            @click="resetFilters"
          />
        </div>
      </div>

    <!-- Main Table Container -->
    <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-xs overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="flex-1 overflow-auto custom-scrollbar">
        <UTable
          :columns="columns"
          :data="paginatedOrders"
          :loading="pending"
          sticky
          class="min-w-full"
        >
          <!-- Order ID & Trade Info Cell -->
          <template #id-cell="{ row }">
            <div class="flex flex-col min-w-[160px] py-0.5">
              <span
                class="text-sm font-mono font-medium text-gray-900 dark:text-white cursor-pointer hover:text-primary-500 transition-colors flex items-center gap-1.5"
                :title="row.original.id"
                @click="copyToClipboard(row.original.id, t('admin.orders.modal.order_id'))"
              >
                {{ row.original.id }}
                <UIcon
                  name="ph:copy-simple"
                  class="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-primary-500 transition-opacity"
                />
              </span>
              <div
                v-if="row.original.payMethod || row.original.tradeNo"
                class="flex items-center gap-1.5 mt-1 text-xs text-gray-500"
              >
                <span
                  v-if="row.original.payMethod"
                  class="capitalize px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800/80 rounded text-[10px] font-medium text-gray-600 dark:text-gray-300"
                >
                  {{ row.original.payMethod }}
                </span>
                <template v-if="row.original.tradeNo">
                  <span class="text-gray-400">•</span>
                  <UIcon
                    name="ph:receipt"
                    class="w-3.5 h-3.5 text-gray-400 shrink-0"
                  />
                  <span
                    class="font-mono text-[11px] truncate max-w-[120px] cursor-pointer hover:text-primary-500 transition-colors"
                    :title="$t('admin.orders.modal.trade_no') + ': ' + row.original.tradeNo"
                    @click="copyToClipboard(row.original.tradeNo, t('admin.orders.modal.trade_no'))"
                  >
                    {{ row.original.tradeNo }}
                  </span>
                </template>
              </div>
            </div>
          </template>

          <!-- Product Details Cell -->
          <template #productName-cell="{ row }">
            <div class="flex items-center gap-3 py-0.5">
              <!-- Cover Thumbnail -->
              <div class="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center border border-gray-200/80 dark:border-gray-800 shadow-2xs">
                <img
                  v-if="row.original.productImage"
                  :src="buildImageProxyUrl(row.original.productImage)"
                  :alt="row.original.productName || ''"
                  class="w-full h-full object-cover"
                />
                <UIcon
                  v-else
                  name="ph:package"
                  class="text-gray-400 w-5 h-5"
                />
              </div>

              <!-- Info -->
              <div class="flex flex-col min-w-0">
                <NuxtLink
                  v-if="row.original.productId"
                  :to="`/products/${row.original.productSlug || row.original.productId}`"
                  target="_blank"
                  class="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-500 hover:underline truncate"
                  :title="row.original.productName || undefined"
                >
                  {{ row.original.productName }}
                </NuxtLink>
                <span
                  v-else
                  class="text-sm font-medium text-gray-900 dark:text-white truncate"
                >
                  {{ row.original.productName || $t('admin.orders.unknown_product') }}
                </span>

                <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span
                    v-if="row.original.productType"
                    class="capitalize px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono"
                  >
                    {{ row.original.productType }}
                  </span>
                  <span class="text-emerald-500 font-semibold font-mono">
                    {{ formatCurrencyAmount(row.original.amount, row.original.currency) }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- User / Buyer Cell -->
          <template #user-cell="{ row }">
            <div class="flex flex-col py-0.5">
              <!-- Registered user -->
              <template v-if="row.original.userEmail">
                <span class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  <UIcon
                    name="ph:user-circle-fill"
                    class="w-4 h-4 text-purple-500 shrink-0"
                  />
                  {{ row.original.userNickname || String(row.original.userEmail || '').split('@')[0] }}
                </span>
                <span class="text-xs text-gray-500 mt-0.5 font-mono">{{ row.original.userEmail }}</span>
              </template>
              <!-- Anonymous visitor -->
              <template v-else>
                <span class="text-sm text-gray-700 dark:text-gray-300 font-mono">{{ row.original.contactEmail || $t('admin.orders.na') }}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <UIcon
                    name="ph:ghost"
                    class="w-3.5 h-3.5 text-gray-400 shrink-0"
                  />
                  <span
                    v-if="row.original.visitorId"
                    class="text-xs text-gray-500 font-mono cursor-pointer hover:text-primary-500 transition-colors"
                    :title="String(row.original.visitorId)"
                    @click="copyVisitorId(String(row.original.visitorId))"
                  >
                    {{ String(row.original.visitorId).substring(0, 8) }}...
                  </span>
                  <span
                    v-else
                    class="text-xs text-gray-400"
                  >
                    {{ $t('admin.orders.no_visitor_id') }}
                  </span>
                </div>
              </template>
            </div>
          </template>

          <!-- Status & Actions Cell -->
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-3 py-0.5">
              <div class="flex flex-col items-end">
                <span class="text-xs text-gray-400 dark:text-gray-500 mb-1 font-mono">{{ formatDateTime(row.original.createdAt) }}</span>
                <div class="flex items-center gap-1.5">
                  <!-- Payment Status Badge -->
                  <UBadge
                    :color="getPayStatusColor(String(row.original.payStatus || 'pending'))"
                    variant="subtle"
                    class="capitalize whitespace-nowrap text-[11px] px-2 py-0.5 font-medium"
                    :title="$t('admin.orders.payment_label') + ': ' + (row.original.payStatus || 'pending')"
                  >
                    {{ getPayStatusLabel(row.original.payStatus) }}
                  </UBadge>
                  <!-- Fulfillment Status Badge -->
                  <UBadge
                    :color="getStatusColor(String(row.original.status || 'none'))"
                    variant="subtle"
                    class="capitalize whitespace-nowrap text-[11px] px-2 py-0.5 font-medium"
                    :title="$t('admin.orders.fulfillment_label') + ': ' + (row.original.status || 'none')"
                  >
                    {{ getStatusLabel(row.original.status) }}
                  </UBadge>
                </div>
              </div>

              <!-- View Details Button -->
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:eye"
                class="hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="viewDetails(row.original)"
              />
            </div>
          </template>
        </UTable>

        <!-- Empty State -->
        <div
          v-if="orders.length === 0 && !pending"
          class="flex flex-col items-center justify-center py-16 text-center px-4"
        >
          <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
            <UIcon
              name="ph:shopping-bag-open"
              class="w-6 h-6"
            />
          </div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ isFiltered ? $t('admin.orders.no_orders_found') : $t('admin.common.noData') }}
          </p>
          <p
            v-if="isFiltered"
            class="text-xs text-gray-500 mt-1 max-w-sm"
          >
            {{ $t('admin.orders.clear_filters') }}
          </p>
          <UButton
            v-if="isFiltered"
            color="primary"
            variant="soft"
            size="xs"
            class="mt-3"
            icon="ph:arrow-counter-clockwise"
            @click="resetFilters"
          >
            {{ $t('admin.orders.reset_filters') }}
          </UButton>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200/80 dark:border-gray-800/60 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('admin.common.showing') }} <span class="text-gray-900 dark:text-white font-medium">{{ totalItems > 0 ? Math.min(totalItems, (page - 1) * pageCount + 1) : 0 }}</span> {{ $t('admin.common.to') }} <span class="text-gray-900 dark:text-white font-medium">{{ Math.min(page * pageCount, totalItems) }}</span> {{ $t('admin.common.of') }} <span class="text-gray-900 dark:text-white font-medium">{{ totalItems }}</span> {{ $t('admin.common.results') }}
        </div>
        <UPagination
          v-model="page"
          :total="totalItems"
          :items-per-page="pageCount"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>
    </div>

    <!-- Order Details Modal -->
    <FullScreenModal
      v-model="isModalOpen"
      maxWidth="sm:max-w-3xl"
      :title="$t('admin.orders.modal.title')"
    >
      <div
        v-if="selectedOrder"
        class="space-y-6 p-6"
      >
        <!-- Basic Info Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-black/20">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.order_id') }}</p>
            <p class="text-sm font-mono font-medium text-gray-900 dark:text-white">{{ selectedOrder.id }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.amount') }}</p>
            <p class="text-sm font-semibold text-emerald-500">{{ formatCurrencyAmount(selectedOrder.amount, selectedOrder.currency) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.payment_status') }}</p>
            <UBadge
              :color="getPayStatusColor(selectedOrder.payStatus)"
              variant="subtle"
              class="capitalize mt-0.5"
            >
              {{ getPayStatusLabel(selectedOrder.payStatus) }}
            </UBadge>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.fulfillment_status') }}</p>
            <UBadge
              :color="getStatusColor(selectedOrder.status)"
              variant="subtle"
              class="capitalize mt-0.5"
            >
              {{ getStatusLabel(selectedOrder.status) }}
            </UBadge>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.contact_email') }}</p>
            <p class="text-sm text-gray-900 dark:text-white font-mono">{{ selectedOrder.contactEmail || $t('admin.orders.na') }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.payment_method') }}</p>
            <p class="text-sm text-gray-900 dark:text-white">{{ selectedOrder.payMethod || $t('admin.orders.na') }}</p>
          </div>
          <div class="sm:col-span-2">
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.orders.modal.trade_no') }}</p>
            <p class="text-sm text-gray-900 dark:text-white font-mono">{{ selectedOrder.tradeNo || $t('admin.orders.na') }}</p>
          </div>
        </div>

        <!-- Meta Data Details -->
        <div
          v-if="selectedOrder.metaData"
          class="p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#1a1a1c]"
        >
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white mb-2">{{ $t('admin.orders.modal.meta_data') }}</h3>
          <pre class="text-xs text-gray-700 dark:text-gray-300 overflow-auto whitespace-pre-wrap font-mono">{{ formatMetaData(selectedOrder.metaData) }}</pre>
        </div>

        <!-- Payment Link for Pending Orders -->
        <div
          v-if="selectedOrder.payStatus === 'pending'"
          class="p-4 border border-amber-500/30 rounded-xl bg-amber-50/40 dark:bg-amber-950/20"
        >
          <h3 class="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <UIcon
              name="ph:link"
              class="w-4 h-4"
            />
            {{ $t('admin.orders.modal.payment_link_title') }}
          </h3>
          <div class="space-y-3">
            <div class="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-white/80 dark:bg-black/40 px-3 py-2">
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('admin.orders.modal.payment_link') }}</p>
              <p class="text-xs font-mono text-gray-900 dark:text-white break-all select-all">
                {{ getFrontendPaymentUrl(selectedOrder.id) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="primary"
                variant="soft"
                size="xs"
                icon="ph:credit-card"
                :to="getFrontendPaymentPath(selectedOrder.id)"
                target="_blank"
              >
                {{ $t('admin.orders.modal.open_payment_page') }}
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                icon="ph:copy"
                @click="copyFrontendPaymentUrl(selectedOrder.id)"
              >
                {{ $t('admin.orders.modal.copy_payment_link') }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- Fulfillment & Status Update Form -->
        <div class="p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#1a1a1c]">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-white mb-4">{{ $t('admin.orders.modal.fulfillment_title') }}</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="$t('admin.orders.modal.update_fulfillment')">
                <USelect
                  v-model="selectedOrder.status"
                  class="w-full"
                  :items="orderStatusOptions"
                />
              </UFormField>
              <UFormField :label="$t('admin.orders.modal.update_payment')">
                <USelect
                  v-model="selectedOrder.payStatus"
                  class="w-full"
                  :items="payStatusOptions"
                />
              </UFormField>
            </div>
            <UFormField :label="$t('admin.orders.modal.delivery_info')">
              <UTextarea
                v-model="selectedOrder.deliveryInfo"
                :rows="3"
                class="text-gray-900 dark:text-white w-full"
              />
            </UFormField>
            <div class="flex justify-end">
              <UButton
                color="primary"
                :loading="isSaving"
                @click="saveOrder"
              >
                {{ $t('admin.orders.modal.update_order') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </FullScreenModal>

    <!-- Manual Order Creation Modal -->
    <AdminOrdersManualOrderModal
      v-model="isManualOrderOpen"
      @success="handleManualOrderSuccess"
    />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { definePageMeta, useToast, useFetch, useRoute, useRouter, useI18n, useRequestURL } from '#imports'
import AdminOrdersManualOrderModal from '~/components/admin/orders/ManualOrderModal.vue'
import AdminTopupRecordsPanel from '~/components/AdminTopupRecordsPanel.vue'

const { t, te } = useI18n()
const { formatDateTime } = useFormatTime()
const { formatCurrencyAmount } = useCurrencyFormat()
const { buildImageProxyUrl } = useImageProxy()

definePageMeta({ title: 'Orders Management', layout: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const requestUrl = useRequestURL()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const activeTab = ref<'orders' | 'topups'>(route.query.tab === 'topups' ? 'topups' : 'orders')

const switchTab = (tab: 'orders' | 'topups') => {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab: tab === 'orders' ? undefined : tab } })
}

watch(() => route.query.tab, (val) => {
  activeTab.value = val === 'topups' ? 'topups' : 'orders'
})

interface AdminOrderRow {
  id: string
  payMethod?: string | null
  tradeNo?: string | null
  productImage?: string | null
  productName?: string | null
  productId?: number | string | null
  productSlug?: string | null
  productType?: string | null
  amount: number
  currency?: string | null
  userEmail?: string | null
  userNickname?: string | null
  contactEmail?: string | null
  payStatus?: string | null
  status?: string | null
  [key: string]: unknown
}

const columns = computed(() => [
  { accessorKey: 'id', header: t('admin.orders.id') },
  { accessorKey: 'productName', header: t('admin.dashboard.product') },
  { accessorKey: 'user', header: t('admin.orders.user') },
  {
    accessorKey: 'actions',
    header: t('admin.common.actions'),
    meta: {
      class: {
        th: 'text-right sticky right-0 z-30 bg-white/95 backdrop-blur-md dark:bg-[#121214]/95 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
        td: 'text-right font-medium sticky right-0 bg-white dark:bg-[#121214] z-10 before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-white dark:before:from-transparent dark:before:to-[#121214]',
      },
    },
  },
])

// Pagination & Filters
const { page, pageSize: pageCount, onPageChange } = usePagination(15)
const activePayStatus = ref('all')
const activeFulfillmentStatus = ref('all')
const searchInput = ref('')
const searchKeyword = ref('')

let searchDebounceTimer: any = null
watch(searchInput, (val) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchKeyword.value = (val || '').trim()
    page.value = 1
  }, 350)
})

const isFiltered = computed(() => activePayStatus.value !== 'all' || activeFulfillmentStatus.value !== 'all' || !!searchKeyword.value)

const selectPayStatus = (val: string) => {
  activePayStatus.value = val
  page.value = 1
}

const resetFilters = () => {
  activePayStatus.value = 'all'
  activeFulfillmentStatus.value = 'all'
  searchInput.value = ''
  searchKeyword.value = ''
  page.value = 1
}

const {
  data: ordersData,
  pending,
  refresh,
} = await useFetch<any>('/api/admin/orders', {
  query: computed(() => ({
    page: page.value,
    pageSize: pageCount.value,
    payStatus: activePayStatus.value !== 'all' ? activePayStatus.value : undefined,
    status: activeFulfillmentStatus.value !== 'all' ? activeFulfillmentStatus.value : undefined,
    search: searchKeyword.value || undefined,
  })),
  watch: [page, activePayStatus, activeFulfillmentStatus, searchKeyword],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/admin/login')
    }
  },
})

const orders = computed<AdminOrderRow[]>(() => ordersData.value?.data || [])
const totalItems = computed(() => ordersData.value?.total || 0)
const stats = computed(() => ordersData.value?.stats || { total: 0, paid: 0, pending: 0, failed: 0, refunded: 0, deleted: 0 })
const frontendOrigin = computed(() => requestUrl.origin.replace(/\/$/, ''))

// Pay Status Filter Pills with live counters
const payStatusPills = computed(() => [
  { value: 'all', label: t('admin.orders.all'), count: stats.value.total, dotColor: '' },
  { value: 'paid', label: t('admin.orders.pay_status_paid'), count: stats.value.paid, dotColor: 'bg-emerald-500' },
  { value: 'pending', label: t('admin.orders.pay_status_pending'), count: stats.value.pending, dotColor: 'bg-amber-500' },
  { value: 'failed', label: t('admin.orders.pay_status_failed'), count: stats.value.failed, dotColor: 'bg-red-500' },
  { value: 'refunded', label: t('admin.orders.pay_status_refunded'), count: stats.value.refunded, dotColor: 'bg-purple-500' },
])

const fulfillmentFilterOptions = computed(() => [
  { value: 'all', label: t('admin.orders.all_fulfillment') },
  { value: 'processing', label: t('admin.orders.status_processing') },
  { value: 'active', label: t('admin.orders.status_active') },
  { value: 'delivered', label: t('admin.orders.status_delivered') },
  { value: 'completed', label: t('admin.orders.status_completed') },
  { value: 'failed', label: t('admin.orders.status_failed') },
  { value: 'none', label: t('admin.orders.status_none') },
])

const isModalOpen = ref(false)
const isManualOrderOpen = ref(false)
const selectedOrder = ref<any>(null)
const isSaving = ref(false)

const handleManualOrderSuccess = async () => {
  await refresh()
}

const getPayStatusLabel = (payStatus?: string) => {
  const status = payStatus || 'pending'
  const key = `admin.orders.pay_status_${status}`
  return te(key) ? t(key) : status
}

const getStatusLabel = (status?: string) => {
  const s = status || 'none'
  const key = `admin.orders.status_${s}`
  return te(key) ? t(key) : s
}

const orderStatusValues = ['none', 'processing', 'active', 'delivered', 'expired', 'failed', 'completed', 'cancelled', 'deleted'] as const
const orderStatusOptions = computed(() => orderStatusValues.map(value => ({ value, label: getStatusLabel(value) })))

const payStatusValues = ['pending', 'paid', 'failed', 'refunded', 'cancelled', 'expired', 'closed', 'deleted'] as const
const payStatusOptions = computed(() => payStatusValues.map(value => ({ value, label: getPayStatusLabel(value) })))

const formatMetaData = (metaData: any) => {
  if (!metaData) return ''
  try {
    const obj = typeof metaData === 'string' ? JSON.parse(metaData) : metaData
    return JSON.stringify(obj, null, 2)
  } catch (e) {
    return String(metaData)
  }
}

const saveOrder = async () => {
  if (!selectedOrder.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/admin/orders/${selectedOrder.value.id}`, {
      method: 'PUT',
      body: {
        status: selectedOrder.value.status,
        payStatus: selectedOrder.value.payStatus,
        deliveryInfo: selectedOrder.value.deliveryInfo,
      },
    })
    toast.add({
      title: t('admin.orders.toast.success'),
      description: t('admin.orders.toast.order_updated'),
      color: 'success',
    })
    await refresh()
    isModalOpen.value = false
  } catch (e: any) {
    toast.add({
      title: t('admin.orders.toast.error'),
      description: e.data?.message || t('admin.orders.toast.update_failed'),
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const paginatedOrders = computed(() => {
  return orders.value
})

const getPayStatusColor = (payStatus: string): any => {
  switch (payStatus) {
    case 'pending':
      return 'warning'
    case 'paid':
      return 'success'
    case 'failed':
    case 'deleted':
    case 'expired':
      return 'error'
    case 'refunded':
    case 'cancelled':
    case 'closed':
      return 'info'
    default:
      return 'neutral'
  }
}

const getStatusColor = (status: string): any => {
  switch (status) {
    case 'processing':
    case 'active':
      return 'warning'
    case 'delivered':
    case 'completed':
      return 'success'
    case 'expired':
    case 'failed':
    case 'deleted':
      return 'error'
    case 'cancelled':
      return 'info'
    default:
      return 'neutral'
  }
}

const copyVisitorId = (id: string) => {
  if (!id) return
  navigator.clipboard.writeText(id)
  toast.add({
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.visitor_id_copied'),
    color: 'success',
  })
}

const copyToClipboard = (text: string, label: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.add({
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.copied_to_clipboard', { label }),
    color: 'success',
  })
}

const getFrontendPaymentPath = (orderId?: string) => `/payment/${orderId || ''}`

const getFrontendPaymentUrl = (orderId?: string) => `${frontendOrigin.value}${getFrontendPaymentPath(orderId)}`

const copyFrontendPaymentUrl = (orderId?: string) => {
  if (!orderId) return
  navigator.clipboard.writeText(getFrontendPaymentUrl(orderId))
  toast.add({
    title: t('admin.orders.toast.copied'),
    description: t('admin.orders.toast.payment_link_copied'),
    color: 'success',
  })
}

const viewDetails = (order: any) => {
  selectedOrder.value = { ...order }
  isModalOpen.value = true
}
</script>
