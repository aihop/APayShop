<template>
  <div class="min-h-[calc(100vh-8rem)] flex flex-col gap-6 pb-8">
    <!-- Header with Range Selector & Quick Actions -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.dashboard.title', '经营概览') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {{ dashboardData?.timezone ? `时区: ${dashboardData.timezone} · ` : '' }}
          实时营收趋势、待办处置与业务动态
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <!-- Range Filter Buttons -->
        <div class="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl shrink-0">
          <button
            v-for="r in rangeOptions"
            :key="r.value"
            type="button"
            class="px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
            :class="selectedRange === r.value
              ? 'bg-white dark:bg-[#1a1a1e] text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            @click="selectedRange = r.value"
          >
            {{ r.label }}
          </button>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="ph:arrows-clockwise"
          size="sm"
          :loading="pending"
          class="hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="() => refresh()"
        />
      </div>
    </div>

    <!-- 1. 核心经营指标 (4 Cards) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 今日 / 当前周期营收 -->
      <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition">
        <div class="flex justify-between items-start mb-3">
          <span class="text-gray-500 dark:text-gray-400 text-xs font-medium">{{ $t('admin.dashboard.todayRevenue', '今日营收') }}</span>
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <UIcon name="ph:currency-dollar-bold" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ formatCurrencyTotals(dashboardData?.stats?.todayRevenueByCurrency, dashboardData?.stats?.currency) }}
        </div>
        <div class="mt-2 text-[11px] text-gray-400">
          累计实收: {{ formatCurrencyTotals(dashboardData?.stats?.totalRevenueByCurrency, dashboardData?.stats?.currency) }}
        </div>
      </div>

      <!-- 今日 / 累计订单数 -->
      <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition">
        <div class="flex justify-between items-start mb-3">
          <span class="text-gray-500 dark:text-gray-400 text-xs font-medium">{{ $t('admin.dashboard.todayOrders', '今日订单') }}</span>
          <div class="p-2 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <UIcon name="ph:shopping-cart-bold" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ dashboardData?.stats?.todayOrders || 0 }} <span class="text-xs font-normal text-gray-400">笔</span>
        </div>
        <div class="mt-2 text-[11px] text-gray-400">
          历史累计成交: {{ (dashboardData?.stats?.totalOrders || 0).toLocaleString() }} 笔
        </div>
      </div>

      <!-- 客户总数与订阅 -->
      <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition">
        <div class="flex justify-between items-start mb-3">
          <span class="text-gray-500 dark:text-gray-400 text-xs font-medium">客户规模</span>
          <div class="p-2 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <UIcon name="ph:users-bold" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ (dashboardData?.stats?.totalUsers || 0).toLocaleString() }} <span class="text-xs font-normal text-gray-400">位</span>
        </div>
        <div class="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <UIcon name="ph:check-circle-fill" class="w-3 h-3" />
          <span>{{ dashboardData?.stats?.activeSubscriptions || 0 }} 个生效中的订阅计划</span>
        </div>
      </div>

      <!-- 在售商品与卡密健康度 -->
      <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition">
        <div class="flex justify-between items-start mb-3">
          <span class="text-gray-500 dark:text-gray-400 text-xs font-medium">在售商品</span>
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <UIcon name="ph:package-bold" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {{ dashboardData?.stats?.activeProducts || 0 }} <span class="text-xs font-normal text-gray-400">款</span>
        </div>
        <div class="mt-2 text-[11px]" :class="dashboardData?.actionItems?.lowStockCards ? 'text-amber-500 font-semibold' : 'text-gray-400'">
          {{ dashboardData?.actionItems?.lowStockCards ? `⚠️ ${dashboardData.actionItems.lowStockCards} 款卡密库存偏低` : '所有卡密库存充足' }}
        </div>
      </div>
    </div>

    <!-- 2. 中部走势图与品类构成 (Grid: 1.6fr / 1fr) -->
    <div class="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
      <!-- 营收走势图 -->
      <div class="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs flex flex-col">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('admin.dashboard.revenueOverview', '营收与订单走势') }}</h2>
            <p class="text-xs text-gray-400 mt-0.5">{{ selectedRangeLabel }}交易波动与收益曲线</p>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">营收 ({{ dashboardData?.chart?.currency || 'USD' }})</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">订单数</span>
            </div>
          </div>
        </div>

        <div class="h-[280px] w-full relative group pb-6 flex-1">
          <svg
            v-if="svgData"
            class="w-full h-full overflow-visible"
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            @mouseleave="hoveredIndex = null"
          >
            <defs>
              <linearGradient
                id="area-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stop-color="#10b981"
                  stop-opacity="0.25"
                />
                <stop
                  offset="100%"
                  stop-color="#10b981"
                  stop-opacity="0"
                />
              </linearGradient>
            </defs>

            <!-- 网格线 -->
            <g
              stroke="#e5e7eb"
              class="dark:stroke-gray-800"
              stroke-width="0.1"
              stroke-dasharray="2 2"
            >
              <line
                v-for="i in 5"
                :key="i"
                x1="0"
                :y1="TOP + (i-1)*(HEIGHT/4)"
                x2="100"
                :y2="TOP + (i-1)*(HEIGHT/4)"
              />
            </g>

            <!-- hover 竖线 -->
            <line
              v-if="hoveredIndex !== null && svgData?.points[hoveredIndex]"
              :x1="svgData.points[hoveredIndex].x"
              y1="0"
              :x2="svgData.points[hoveredIndex].x"
              y2="50"
              stroke="#9ca3af"
              stroke-width="0.3"
              stroke-dasharray="2 2"
              vector-effect="non-scaling-stroke"
            />

            <!-- 面积 -->
            <path
              :d="svgData.areaPath"
              fill="url(#area-gradient)"
              class="transition-all duration-500"
            />

            <!-- 折线 -->
            <path
              :d="svgData.linePath"
              fill="none"
              stroke="#10b981"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />

            <!-- 数据交互点 -->
            <g
              v-for="(point, index) in svgData.points"
              :key="index"
            >
              <rect
                :x="index === 0 ? 0 : point.x - (50 / (svgData.points.length - 1))"
                y="0"
                :width="100 / (svgData.points.length - 1)"
                height="50"
                fill="transparent"
                class="cursor-crosshair"
                @mouseenter="hoveredIndex = Number(index)"
              />

              <circle
                :cx="point.x"
                :cy="point.y"
                :r="hoveredIndex === index ? 1.2 : 0.6"
                :fill="hoveredIndex === index ? '#fff' : '#10b981'"
                :stroke="hoveredIndex === index ? '#10b981' : '#121214'"
                stroke-width="0.8"
                class="transition-all duration-200"
                vector-effect="non-scaling-stroke"
              />
            </g>
          </svg>

          <!-- x 轴刻度标签 -->
          <div
            v-if="dashboardData?.chart?.labels?.length"
            class="absolute bottom-0 left-0 w-full flex justify-between pb-2"
          >
            <span
              v-for="(label, i) in dashboardData.chart.labels"
              :key="i"
              class="text-[10px] font-mono text-gray-400 whitespace-nowrap absolute transform -translate-x-1/2"
              :style="{ left: `${(Number(i) / (dashboardData.chart.labels.length - 1)) * 100}%` }"
            >
              <template v-if="shouldShowXLabel(i, dashboardData.chart.labels.length)">
                {{ label }}
              </template>
            </span>
          </div>

          <!-- Tooltip 浮层 -->
          <Transition name="fade">
            <div
              v-if="hoveredIndex !== null && dashboardData?.chart"
              class="absolute z-30 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-700/50 rounded-xl p-3.5 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
              :style="{
                left: svgData?.points[hoveredIndex]?.x + '%',
                top: `${(svgData?.points[hoveredIndex]?.y / 50) * 100}%`
              }"
            >
              <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                {{ dashboardData.chart.labels[hoveredIndex] }}
              </div>
              <div class="space-y-1.5 min-w-[130px]">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs text-gray-500">营收:</span>
                  <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {{ formatCurrencyAmount(dashboardData.chart.revenue[hoveredIndex], dashboardData.chart.currency) }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs text-gray-500">订单数:</span>
                  <span class="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {{ dashboardData.chart.orders[hoveredIndex] }} 笔
                  </span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 品类与收入构成 -->
      <div class="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-bold text-gray-900 dark:text-white">业务品类构成</h2>
            <NuxtLink to="/admin/products" class="text-xs text-primary-600 hover:text-primary-700 font-medium">
              管理商品
            </NuxtLink>
          </div>
          <p class="text-xs text-gray-400 mb-6">各业务类型实收与订单占比分布</p>

          <!-- 品类条目 -->
          <div class="space-y-4">
            <div v-for="item in productMixDisplay" :key="item.type" class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <UIcon :name="item.icon" class="w-3.5 h-3.5" :class="item.iconClass" />
                  {{ item.name }}
                </span>
                <span class="text-gray-500 font-mono">
                  {{ item.count }} 笔 · {{ formatCurrencyAmount(item.amount, dashboardData?.stats?.currency) }}
                </span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="item.barClass"
                  :style="{ width: `${item.percentage}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷入口卡片 -->
        <div class="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800/60 grid grid-cols-2 gap-2">
          <NuxtLink
            to="/admin/products?tab=cards"
            class="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 hover:border-purple-500/40 transition text-xs"
          >
            <UIcon name="ph:barcode-bold" class="w-4 h-4 text-purple-500" />
            <span class="font-medium text-gray-700 dark:text-gray-300">卡密库存</span>
          </NuxtLink>

          <NuxtLink
            to="/admin/products?tab=subscriptions"
            class="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 hover:border-blue-500/40 transition text-xs"
          >
            <UIcon name="ph:calendar-check-bold" class="w-4 h-4 text-blue-500" />
            <span class="font-medium text-gray-700 dark:text-gray-300">订阅计划</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 3. 下部：待办处置与实时交易动态 (Grid: 1fr / 1.6fr) -->
    <div class="grid grid-cols-1 xl:grid-cols-[1fr_1.6fr] gap-6">
      <!-- 待办与系统健康 (Action Center) -->
      <div class="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="ph:bell-ringing-bold" class="w-4 h-4 text-primary-500" />
            运营待办与预警
          </h2>
          <UBadge
            :color="hasActionItems ? 'warning' : 'success'"
            variant="subtle"
            size="sm"
          >
            {{ hasActionItems ? '需要关注' : '状态良好' }}
          </UBadge>
        </div>
        <p class="text-xs text-gray-400 mb-5">集中处置待发货、卡密不足与充值异常</p>

        <div class="space-y-3 flex-1">
          <!-- 待发货订单 -->
          <NuxtLink
            to="/admin/orders"
            class="flex items-center justify-between p-3.5 rounded-xl border transition"
            :class="dashboardData?.actionItems?.pendingFulfillments
              ? 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-500'
              : 'border-gray-200/60 dark:border-gray-800/50 bg-gray-50/30 dark:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UIcon name="ph:truck-bold" class="w-4 h-4" />
              </div>
              <div>
                <div class="text-xs font-semibold text-gray-900 dark:text-white">待履约发货订单</div>
                <div class="text-[11px] text-gray-400">已付款待处理订单</div>
              </div>
            </div>
            <span class="text-sm font-bold font-mono" :class="dashboardData?.actionItems?.pendingFulfillments ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'">
              {{ dashboardData?.actionItems?.pendingFulfillments || 0 }}
            </span>
          </NuxtLink>

          <!-- 卡密低库存 -->
          <NuxtLink
            to="/admin/products?tab=cards"
            class="flex items-center justify-between p-3.5 rounded-xl border transition"
            :class="dashboardData?.actionItems?.lowStockCards
              ? 'border-red-500/40 bg-red-50/40 dark:bg-red-950/20 hover:border-red-500'
              : 'border-gray-200/60 dark:border-gray-800/50 bg-gray-50/30 dark:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <UIcon name="ph:warning-bold" class="w-4 h-4" />
              </div>
              <div>
                <div class="text-xs font-semibold text-gray-900 dark:text-white">卡密库存预警</div>
                <div class="text-[11px] text-gray-400">可用库存 ≤ 3 条的卡密商品</div>
              </div>
            </div>
            <span class="text-sm font-bold font-mono" :class="dashboardData?.actionItems?.lowStockCards ? 'text-red-600 dark:text-red-400' : 'text-gray-400'">
              {{ dashboardData?.actionItems?.lowStockCards || 0 }}
            </span>
          </NuxtLink>

          <!-- 待重试充值 -->
          <NuxtLink
            to="/admin/orders?tab=topups"
            class="flex items-center justify-between p-3.5 rounded-xl border transition"
            :class="dashboardData?.actionItems?.pendingTopups
              ? 'border-purple-500/40 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-500'
              : 'border-gray-200/60 dark:border-gray-800/50 bg-gray-50/30 dark:bg-white/5'"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <UIcon name="ph:wallet-bold" class="w-4 h-4" />
              </div>
              <div>
                <div class="text-xs font-semibold text-gray-900 dark:text-white">充值待补单/待审</div>
                <div class="text-[11px] text-gray-400">需要人工重试或核对的充值流水</div>
              </div>
            </div>
            <span class="text-sm font-bold font-mono" :class="dashboardData?.actionItems?.pendingTopups ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'">
              {{ dashboardData?.actionItems?.pendingTopups || 0 }}
            </span>
          </NuxtLink>
        </div>

        <!-- 快捷通道 -->
        <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
          <span class="text-xs text-gray-400">快捷操作</span>
          <div class="flex items-center gap-2">
            <NuxtLink to="/admin/orders" class="text-xs text-primary-600 hover:text-primary-700 font-medium">订单管理 →</NuxtLink>
          </div>
        </div>
      </div>

      <!-- 实时交易流水 (Recent Orders) -->
      <div class="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-xs flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ t('admin.dashboard.recentTransactions') }}</h2>
            <p class="text-xs text-gray-400 mt-0.5">{{ t('admin.dashboard.recentTransactionsDesc') }}</p>
          </div>
          <NuxtLink to="/admin/orders" class="text-xs text-primary-600 hover:text-primary-700 font-medium">
            {{ t('admin.dashboard.viewAllOrders') }}
          </NuxtLink>
        </div>

        <div class="flex-1 overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800/80 text-left text-gray-400 font-medium">
                <th class="py-2.5 pr-3">{{ t('admin.dashboard.orderAndCustomer') }}</th>
                <th class="py-2.5 pr-3">{{ t('admin.orders.amount') }}</th>
                <th class="py-2.5 pr-3">{{ t('admin.orders.payStatus') }}</th>
                <th class="py-2.5 pr-3">{{ t('admin.orders.fulfillment_label') }}</th>
                <th class="py-2.5 text-right">{{ t('admin.orders.date') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
              <tr
                v-for="order in dashboardData?.recentOrders || []"
                :key="order.id"
                class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition"
              >
                <td class="py-2.5 pr-3">
                  <div class="font-mono font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{{ order.id }}</div>
                  <div class="text-[10px] text-gray-400 truncate max-w-[140px]">{{ order.contactEmail || t('admin.dashboard.anonymousOrder') }}</div>
                </td>
                <td class="py-2.5 pr-3 whitespace-nowrap">
                  <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrencyAmount(order.amount, order.currency) }}</span>
                </td>
                <td class="py-2.5 pr-3 whitespace-nowrap">
                  <UBadge
                    :color="getPayStatusColor(order.payStatus)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ getPayStatusLabel(order.payStatus) }}
                  </UBadge>
                </td>
                <td class="py-2.5 pr-3 whitespace-nowrap">
                  <UBadge
                    :color="getFulfillmentStatusColor(order.status)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ getFulfillmentStatusLabel(order.status) }}
                  </UBadge>
                </td>
                <td class="py-2.5 text-right whitespace-nowrap text-gray-400 text-[11px]">
                  {{ formatDateTime(order.createdAt) }}
                </td>
              </tr>
              <tr v-if="!dashboardData?.recentOrders?.length">
                <td colspan="5" class="py-8 text-center text-gray-400">{{ t('admin.dashboard.noOrderData') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  definePageMeta,
  useI18n,
  useFetch,
  useRouter,
} from '#imports'

definePageMeta({ title: 'Dashboard', layout: 'admin' })

const { t } = useI18n()
const { formatCurrencyAmount, formatCurrencyTotals } = useCurrencyFormat()
const { formatDateTime } = useFormatTime()
const {
  OrderPayStatus,
  OrderFulfillmentStatus,
  getPayStatusLabel,
  getPayStatusColor,
  getFulfillmentStatusLabel,
  getFulfillmentStatusColor,
} = useOrderStatus()
const router = useRouter()
const hoveredIndex = ref<number | null>(null)
const selectedRange = ref<'today' | '7d' | '30d'>('today')

const rangeOptions = [
  { label: '今日 24h', value: 'today' as const },
  { label: '近 7 天', value: '7d' as const },
  { label: '近 30 天', value: '30d' as const },
]

const selectedRangeLabel = computed(() => {
  const opt = rangeOptions.find(r => r.value === selectedRange.value)
  return opt ? opt.label : '今日'
})

const { data: dashboardData, pending, refresh } = await useFetch<any>('/api/admin/dashboard', {
  query: computed(() => ({
    range: selectedRange.value,
  })),
  onResponseError({ response }) {
    if (response.status === 401) router.push('/admin/login')
  },
})

const TOP = 10
const HEIGHT = 36
const svgData = computed(() => {
  const chart = dashboardData.value?.chart
  if (!chart?.revenue?.length) return null

  const data = chart.revenue
  const max = Math.max(...data, 10)
  const len = data.length

  const points = data.map((val: number, i: number) => ({
    x: (i / (len - 1)) * 100,
    y: TOP + HEIGHT - (val / max) * HEIGHT,
  }))

  let linePath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < len - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const cpX = p0.x + (p1.x - p0.x) / 2
    linePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L 100 50 L 0 50 Z`

  return { points, linePath, areaPath }
})

const shouldShowXLabel = (index: number, total: number) => {
  if (total <= 12) return true
  if (total <= 24) return index % 3 === 0 || index === total - 1
  return index % 5 === 0 || index === total - 1
}

const hasActionItems = computed(() => {
  const ai = dashboardData.value?.actionItems
  return Boolean(ai?.pendingFulfillments || ai?.lowStockCards || ai?.pendingTopups)
})

const productMixDisplay = computed(() => {
  const mix = dashboardData.value?.categoryMix || []
  const totalAmount = mix.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 1

  const metaMap: Record<string, { name: string; icon: string; iconClass: string; barClass: string }> = {
    standard: { name: '实物/数字商品', icon: 'ph:package-bold', iconClass: 'text-blue-500', barClass: 'bg-blue-500' },
    key: { name: '卡密库存', icon: 'ph:barcode-bold', iconClass: 'text-purple-500', barClass: 'bg-purple-500' },
    subscription: { name: '订阅服务', icon: 'ph:calendar-check-bold', iconClass: 'text-emerald-500', barClass: 'bg-emerald-500' },
    topup: { name: '钱包充值', icon: 'ph:wallet-bold', iconClass: 'text-amber-500', barClass: 'bg-amber-500' },
  }

  return mix.map((item: any) => {
    const meta = metaMap[item.type] || metaMap.standard
    const percentage = Math.min(100, Math.round(((item.amount || 0) / totalAmount) * 100))
    return {
      ...item,
      ...meta,
      percentage,
    }
  })
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -90%) scale(0.95);
}

svg {
  outline: none;
  user-select: none;
}
</style>
