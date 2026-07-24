<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 shadow-xl rounded-2xl overflow-hidden">
    <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800/60 bg-gray-100 dark:bg-gray-900/20 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
        <UIcon name="ph:wallet-fill" class="w-5 h-5" />
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.topup.title') }}</h2>
    </div>

    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#09090b] rounded-xl border border-gray-200 dark:border-gray-800">
        <div class="flex flex-col gap-1">
          <span class="font-medium text-gray-900 dark:text-white">{{ $t('admin.settings.topup.enabled') }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.enabled_desc') }}</span>
        </div>
        <USwitch v-model="model.enabled" />
      </div>

      <div class="p-4 bg-gray-50 dark:bg-[#09090b] rounded-xl border border-gray-200 dark:border-gray-800">
        <label class="mb-1 block font-medium text-gray-900 dark:text-white">{{ $t('admin.settings.topup.accounting_currency') }}</label>
        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.accounting_currency_desc') }}</p>
        <UInput v-model="model.accountingCurrency" placeholder="USD" class="max-w-[200px]" />
      </div>

      <div class="p-4 bg-gray-50 dark:bg-[#09090b] rounded-xl border border-gray-200 dark:border-gray-800">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <span class="font-medium text-gray-900 dark:text-white">{{ $t('admin.settings.topup.currencies') }}</span>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.currencies_desc') }}</p>
          </div>
          <UButton icon="ph:plus-bold" size="xs" color="neutral" variant="soft" @click="addCurrency">
            {{ $t('admin.settings.topup.add_currency') }}
          </UButton>
        </div>

        <p v-if="!model.currencies.length" class="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          {{ $t('admin.settings.topup.no_currency') }}
        </p>

        <div v-for="(row, index) in model.currencies" :key="index" class="mb-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#121214]">
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.f_currency') }}</label>
              <UInput v-model="row.currency" placeholder="CNY" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.f_min') }}</label>
              <UInput v-model="row.min" type="number" step="0.01" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.f_max') }}</label>
              <UInput v-model="row.max" type="number" step="0.01" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.f_rate') }}</label>
              <UInput v-model="row.rate" type="number" step="0.000001" />
            </div>
            <div class="flex items-end gap-2">
              <div class="flex-1">
                <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ $t('admin.settings.topup.f_presets') }}</label>
                <UInput v-model="row.presets" placeholder="50,100,500" />
              </div>
              <UButton
                icon="ph:trash-fill"
                size="xs"
                color="error"
                variant="soft"
                :aria-label="$t('admin.settings.topup.remove_currency')"
                @click="model.currencies.splice(index, 1)"
              />
            </div>
          </div>

          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ $t('admin.settings.topup.rate_hint', {
              from: (row.currency || '?').toUpperCase(),
              rate: row.rate || 0,
              to: (model.accountingCurrency || 'USD').toUpperCase(),
            }) }}
          </p>
        </div>
      </div>

      <div v-if="issues.length" class="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div class="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <UIcon name="ph:warning-fill" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ $t('admin.settings.topup.issues_title') }}</span>
        </div>
        <ul class="list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-400/90">
          <li v-for="(issue, i) in issues" :key="i">{{ issue }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * topup_rules 是个 JSON 串设置项,这里做结构化编辑:
 * 挂载时把 form.topup_rules 解析进本地模型,任何改动再序列化写回,
 * 保存仍走设置页统一的 saveSettings。
 */
const props = defineProps<{ form: any }>()
const { t } = useI18n()

// 全部用字符串持有:UInput 的 v-model 只接受 string,数字转换统一在 serialize/校验里做
interface CurrencyRow {
  currency: string
  min: string
  max: string
  rate: string
  presets: string
}

const model = reactive<{ enabled: boolean, accountingCurrency: string, currencies: CurrencyRow[] }>({
  enabled: true,
  accountingCurrency: 'USD',
  currencies: [],
})

let hydrated = false

const hydrate = (raw: unknown) => {
  let parsed: any = null
  if (typeof raw === 'string' && raw.trim()) {
    try { parsed = JSON.parse(raw) } catch { parsed = null }
  } else if (raw && typeof raw === 'object') {
    parsed = raw
  }

  model.enabled = parsed?.enabled !== false
  model.accountingCurrency = String(parsed?.accountingCurrency || 'USD')
  const options = (parsed?.options && typeof parsed.options === 'object') ? parsed.options : {}
  model.currencies = Object.entries(options).map(([currency, opt]: [string, any]) => ({
    currency,
    min: String(opt?.min ?? 0),
    max: String(opt?.max ?? 0),
    rate: String(opt?.rate ?? 1),
    presets: Array.isArray(opt?.presets) ? opt.presets.join(',') : '',
  }))
  hydrated = true
}

// 设置数据是异步加载的,首次拿到值时再灌进模型
watch(() => props.form?.topup_rules, (raw) => {
  if (!hydrated) hydrate(raw)
}, { immediate: true })

const addCurrency = () => {
  model.currencies.push({ currency: '', min: '1', max: '10000', rate: '1', presets: '' })
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 提交前的可见性检查——不阻断保存,只提示,避免把人卡在半填状态 */
const issues = computed(() => {
  const list: string[] = []
  const accounting = String(model.accountingCurrency || '').trim().toUpperCase()
  if (!accounting) list.push(t('admin.settings.topup.issue_no_accounting'))

  const seen = new Set<string>()
  for (const row of model.currencies) {
    const code = String(row.currency || '').trim().toUpperCase()
    if (!code) { list.push(t('admin.settings.topup.issue_empty_code')); continue }
    if (seen.has(code)) list.push(t('admin.settings.topup.issue_duplicate', { currency: code }))
    seen.add(code)

    const min = toNumber(row.min), max = toNumber(row.max), rate = toNumber(row.rate)
    if (!(min > 0)) list.push(t('admin.settings.topup.issue_min', { currency: code }))
    if (max < min) list.push(t('admin.settings.topup.issue_max', { currency: code }))
    if (!(rate > 0)) list.push(t('admin.settings.topup.issue_rate', { currency: code }))
    // 记账币种对自己的汇率必须是 1,否则等于凭空放大/缩水余额
    if (code === accounting && rate !== 1) {
      list.push(t('admin.settings.topup.issue_self_rate', { currency: code }))
    }
  }
  if (model.currencies.length && !seen.has(accounting) && accounting) {
    list.push(t('admin.settings.topup.issue_accounting_missing', { currency: accounting }))
  }
  return list
})

const serialize = () => {
  const options: Record<string, any> = {}
  for (const row of model.currencies) {
    const code = String(row.currency || '').trim().toUpperCase()
    if (!code) continue
    options[code] = {
      min: toNumber(row.min),
      max: toNumber(row.max),
      rate: toNumber(row.rate, 1),
      presets: String(row.presets || '')
        .split(',')
        .map(item => Number(String(item).trim()))
        .filter(item => Number.isFinite(item) && item > 0),
    }
  }
  return JSON.stringify({
    enabled: model.enabled,
    accountingCurrency: String(model.accountingCurrency || 'USD').trim().toUpperCase(),
    options,
  })
}

// 任何改动即时写回设置表单,保存按钮无需感知本组件
watch(model, () => {
  if (!hydrated) return
  props.form.topup_rules = serialize()
}, { deep: true })
</script>
