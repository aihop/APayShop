<template>
  <div class="min-h-[calc(100vh-8rem)] flex flex-col gap-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.dashboard.title') }}</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.dashboard.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
      >
        <div class="flex justify-between items-start mb-4">
          <span class="text-gray-500 dark:text-gray-400 text-sm font-medium">{{ stat.label }}</span>
          <div
            :class="`p-2 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-500`"
            class="flex items-center justify-center"
          >
            <Icon
              :name="stat.icon"
              class="w-5 h-5"
            />
          </div>
        </div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ stat.value }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-[#121214] p-6 md:p-8 rounded-2xl border border-gray-200/60 dark:border-gray-800/50 shadow-sm">
      <div class="flex items-center justify-between mb-12">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('admin.dashboard.revenueOverview') }}</h2>

        <div class="flex items-center gap-6">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">Revenue</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-[#a855f7]"></div>
              <span class="text-xs text-gray-500 dark:text-gray-400">Orders</span>
            </div>
          </div>
          <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 px-3 py-1 rounded-full">
            LIVE UPDATE
          </span>
        </div>
      </div>

      <div class="h-[320px] w-full relative group pb-8">
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

          <!-- 网格 -->
          <g
            stroke="#1f2937"
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
            v-if="hoveredIndex !== null"
            :x1="svgData.points[hoveredIndex].x"
            y1="0"
            :x2="svgData.points[hoveredIndex].x"
            y2="50"
            stroke="#4b5563"
            stroke-width="0.5"
            stroke-dasharray="3 3"
            vector-effect="non-scaling-stroke"
          />

          <!-- 面积 -->
          <path
            :d="svgData.areaPath"
            fill="url(#area-gradient)"
            class="transition-all duration-700"
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

          <!-- 点 -->
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
              :r="hoveredIndex === index ? 1 : 0.5"
              :fill="hoveredIndex === index ? '#fff' : '#10b981'"
              :stroke="hoveredIndex === index ? '#10b981' : '#121214'"
              stroke-width="0.8"
              class="transition-all duration-300"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </svg>

        <!-- x轴 -->
        <div
          v-if="dashboardData?.chart?.labels?.length"
          class="absolute bottom-0 left-0 w-full flex justify-between pb-6"
        >
          <span
            v-for="(label, i) in dashboardData.chart.labels"
            :key="i"
            class="text-[10px] font-medium text-gray-500 whitespace-nowrap absolute transform -translate-x-1/2"
            :style="{ left: `${(Number(i) / (dashboardData.chart.labels.length - 1)) * 100}%` }"
          >
            <template v-if="Number(i) % 4 === 0 || Number(i) === dashboardData.chart.labels.length - 1">
              {{ label.includes(' ') ? label.split(' ')[1].substring(0, 5) : label }}
            </template>
          </span>
        </div>

        <!-- tooltip -->
        <Transition name="fade">
          <div
            v-if="hoveredIndex !== null && dashboardData?.chart"
            class="absolute z-30 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 transition-all duration-200"
            :style="{
              left: svgData?.points[hoveredIndex]?.x + '%',
              top: `${(svgData?.points[hoveredIndex]?.y / 50) * 100}%`
            }"
          >
            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-200 dark:border-gray-800 pb-2">
              {{ dashboardData.chart.labels[hoveredIndex] }}
            </div>
            <div class="space-y-2 min-w-[140px]">
              <div class="flex items-center justify-between gap-4">
                <span class="text-xs text-gray-500 dark:text-gray-300">Revenue</span>
                <span class="text-xs font-bold text-gray-900 dark:text-white">
                  {{ formatCurrencyAmount(dashboardData.chart.revenue[hoveredIndex], dashboardData.chart.currency) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-xs text-gray-500 dark:text-gray-300">Orders</span>
                <span class="text-xs font-bold text-gray-900 dark:text-white">
                  {{ dashboardData.chart.orders[hoveredIndex] }}
                </span>
              </div>
            </div>
          </div>
        </Transition>
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
const router = useRouter() 
const hoveredIndex = ref<number | null>(null)

const { data: dashboardData } = await useFetch<any>('/api/admin/dashboard', {
  onResponseError({ response }) {
    if (response.status === 401) router.push('/admin/login')
  },
})
const TOP = 12
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

const stats = computed(() => [
  {
    label: t('admin.dashboard.todayOrders'),
    value: dashboardData.value?.stats?.todayOrders || '0',
    icon: 'ph:shopping-cart',
    color: 'blue',
  },
  {
    label: t('admin.dashboard.todayRevenue'),
    value: formatCurrencyTotals(
      dashboardData.value?.stats?.todayRevenueByCurrency,
      dashboardData.value?.stats?.currency,
    ),
    icon: 'ph:currency-dollar',
    color: 'green',
  },
  {
    label: t('admin.dashboard.totalOrders'),
    value: (dashboardData.value?.stats?.totalOrders || 0).toLocaleString(),
    icon: 'ph:package',
    color: 'purple',
  },
  {
    label: t('admin.dashboard.totalRevenue'),
    value: formatCurrencyTotals(
      dashboardData.value?.stats?.totalRevenueByCurrency,
      dashboardData.value?.stats?.currency,
    ),
    icon: 'ph:chart-line-up',
    color: 'orange',
  },
])
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
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
