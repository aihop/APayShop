<template>
  <div class="bg-slate-50 px-5 py-16 sm:px-8 sm:py-24">
    <div class="mx-auto max-w-[1280px]">
      <div class="mx-auto max-w-3xl text-center">
        <p class="text-sm font-black tracking-[0.18em] text-blue-600 uppercase">Shoply Pricing</p>
        <h1 class="mt-5 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-6xl">{{ copy.title }}</h1>
        <p class="mt-6 text-base leading-8 text-slate-600 sm:text-lg">{{ copy.description }}</p>
      </div>

      <div v-if="status === 'pending'" class="flex justify-center py-24">
        <UIcon name="ph:spinner-gap-bold" class="h-10 w-10 animate-spin text-blue-600" />
      </div>

      <div v-else-if="plans.length" class="mt-14 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="plan in plans" :key="plan.id" class="relative flex min-w-0 flex-col rounded-[2rem] border bg-white p-7 shadow-sm" :class="plan.badge ? 'border-blue-400 shadow-xl shadow-blue-900/10' : 'border-slate-200'">
          <span v-if="plan.badge" class="absolute -top-3 left-7 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-black text-white">{{ plan.badge }}</span>
          <h2 class="mt-2 text-2xl font-black tracking-tight text-slate-950">{{ plan.name }}</h2>
          <p class="mt-3 min-h-14 text-sm leading-7 text-slate-600">{{ plan.description }}</p>
          <div class="mt-7 flex flex-wrap items-baseline gap-2">
            <span class="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ formatAmount(plan.price) }}</span>
            <span class="text-sm font-bold text-slate-500">/ {{ formatCycle(plan.cycle) }}</span>
          </div>
          <div class="mt-8 flex-1 border-t border-slate-100 pt-7">
            <p class="text-sm font-black text-slate-900">{{ copy.included }}</p>
            <ul class="mt-5 space-y-4">
              <li v-for="feature in plan.features" :key="feature.name" class="flex gap-3 text-sm leading-6" :class="feature.included ? 'text-slate-700' : 'text-slate-400 line-through'">
                <UIcon :name="feature.included ? 'ph:check-circle-fill' : 'ph:x-circle'" class="mt-0.5 h-5 w-5 shrink-0" :class="feature.included ? 'text-emerald-500' : 'text-slate-300'" />
                <span>{{ feature.name }}</span>
              </li>
            </ul>
          </div>
          <NuxtLink :to="localePath(`/products/${plan.slug}`)" class="mt-8 rounded-full px-6 py-3.5 text-center text-sm font-extrabold transition-colors" :class="plan.badge ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'">
            {{ copy.action }}
          </NuxtLink>
        </article>
      </div>

      <div v-else class="mx-auto mt-14 max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <UIcon name="ph:package-duotone" class="mx-auto h-14 w-14 text-blue-500" />
        <h2 class="mt-5 text-2xl font-black text-slate-950">{{ copy.emptyTitle }}</h2>
        <p class="mt-3 text-sm leading-7 text-slate-600">{{ copy.emptyDescription }}</p>
        <a :href="consultUrl" class="mt-7 inline-flex rounded-full bg-blue-600 px-7 py-3.5 text-sm font-extrabold text-white">{{ copy.contact }}</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import en from '../../locales/en'
import id from '../../locales/id'
import ru from '../../locales/ru'
import zh from '../../locales/zh'
import zhHK from '../../locales/zh-HK'

interface PlanFeature {
  name: string
  included: boolean
}

interface ProductRecord {
  id: number | string
  name: string
  slug: string
  description?: string | null
  price: number
  type: string
  metaData?: unknown
}

interface ProductsResponse {
  data: ProductRecord[]
}

interface ProductMeta {
  is_pricing_plan?: boolean
  plan_badge?: string
  plan_features?: unknown
  subscription_cycle?: string
  billing_cycle?: string
  translations?: Record<string, {
    name?: string
    description?: string
    plan_badge?: string
    plan_features?: unknown
  }>
}

const { locale } = useI18n()
const { localePath } = useLocaleRouter()
const { formatAmount } = useLocaleCurrency()
const { getSetting } = useSettings()
const localeMessages = { en, zh, 'zh-HK': zhHK, id, ru }
const copy = computed(() => (localeMessages[locale.value as keyof typeof localeMessages] || en).pages.pricing)
const consultUrl = computed(() => getSetting('shoply_consult_url', 'mailto:support@shoply.cn'))

const { data: productsData, status } = await useFetch<ProductsResponse>('/api/products', {
  key: 'shoply-pricing-plans',
  query: { pageSize: 100 },
})

const parseMeta = (value: unknown): ProductMeta => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as ProductMeta
  if (typeof value !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ProductMeta : {}
  } catch {
    return {}
  }
}

const parseFeatures = (value: unknown): PlanFeature[] => {
  let parsed = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item): PlanFeature[] => {
    if (typeof item === 'string' && item.trim()) return [{ name: item.trim(), included: true }]
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const name = String(record.name || '').trim()
    return name ? [{ name, included: record.included !== false }] : []
  })
}

const plans = computed(() => (productsData.value?.data || []).flatMap((product) => {
  const meta = parseMeta(product.metaData)
  if (product.type !== 'subscription' || meta.is_pricing_plan !== true) return []
  const translation = meta.translations?.[locale.value]
  return [{
    id: product.id,
    slug: product.slug,
    name: translation?.name || product.name,
    description: translation?.description || product.description || '',
    price: Number(product.price || 0),
    badge: translation?.plan_badge || meta.plan_badge || '',
    features: parseFeatures(translation?.plan_features || meta.plan_features),
    cycle: meta.subscription_cycle || meta.billing_cycle || '1_month',
  }]
}).sort((left, right) => left.price - right.price))

const formatCycle = (cycle: string) => {
  if (cycle === 'lifetime') return copy.value.cycle.lifetime
  const match = cycle.match(/^(\d+)_(month|year)s?$/)
  if (!match) return cycle.replaceAll('_', ' ')
  const count = Number(match[1])
  const unit = copy.value.cycle[match[2] as 'month' | 'year']
  return count === 1 ? unit : `${count} ${unit}`
}

useSeoMeta({
  title: () => copy.value.seoTitle,
  description: () => copy.value.seoDescription,
  ogTitle: () => copy.value.seoTitle,
  ogDescription: () => copy.value.seoDescription,
})
</script>
