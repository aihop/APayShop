<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">事件自动化</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">配置某个事件发生后自动执行的动作,例如「用户注册成功 → 发放积分奖励」。</p>
      </div>
      <UButton
        v-if="hasAdminPerm('settings:edit')"
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
        icon="ph:plus-bold"
        @click="openCreate"
      >新建规则</UButton>
    </div>

    <!-- 主题内置事件解耦加载状态栏 -->
    <div v-if="builtinRules.length" class="p-4 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-200/60 dark:border-purple-800/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-purple-600/10 dark:bg-purple-400/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
          <UIcon name="ph:sparkle-fill" class="w-5 h-5" />
        </div>
        <div>
          <div class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>当前主题内置自动化事件</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              {{ builtinRules.length }} 项已就绪
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            当前激活主题通过解耦契约自动挂载核心业务生命周期（如 AINode 凭证同步、试用订单履约），随系统启动自动生效。
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded-lg shrink-0">
        <UIcon name="ph:check-circle-fill" class="w-4 h-4" />
        <span>自动生效中</span>
      </div>
    </div>

    <div class="border border-gray-200 dark:border-gray-800/50 rounded-2xl overflow-hidden">
      <div v-if="pending" class="p-10 text-center text-gray-400">
        <UIcon name="ph:spinner-gap-bold" class="w-6 h-6 animate-spin inline-block" />
      </div>
      <div v-else-if="!rules.length" class="p-12 text-center">
        <UIcon name="ph:lightning-duotone" class="w-10 h-10 text-purple-400 mx-auto mb-3" />
        <p class="text-gray-600 dark:text-gray-300">还没有规则</p>
        <p class="text-xs text-gray-400 mt-1">点击「新建规则」,例如给新注册用户自动发放积分。</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800/70">
            <th class="text-left font-medium py-3 px-5">事件</th>
            <th class="text-left font-medium py-3 px-5">动作 / 业务说明</th>
            <th class="text-left font-medium py-3 px-5">执行配置</th>
            <th class="text-left font-medium py-3 px-5">状态</th>
            <th class="text-right font-medium py-3 px-5">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rule in rules"
            :key="rule.id"
            class="border-b border-gray-100 dark:border-gray-800/50"
            :class="{ 'bg-purple-50/30 dark:bg-purple-950/10': rule.isBuiltin }"
          >
            <td class="py-3 px-5 text-gray-900 dark:text-white">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ eventLabel(rule.event) }}</span>
                <span v-if="rule.isBuiltin" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  {{ rule.theme ? `主题内置 · ${rule.theme}` : '主题内置' }}
                </span>
              </div>
            </td>
            <td class="py-3 px-5">
              <div class="text-gray-800 dark:text-gray-200 font-medium">{{ actionLabel(rule.action) }}</div>
              <div v-if="rule.config?.description" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-md">{{ rule.config.description }}</div>
            </td>
            <td class="py-3 px-5 text-gray-500 dark:text-gray-400">{{ configSummary(rule) }}</td>
            <td class="py-3 px-5">
              <USwitch :model-value="rule.enabled" :disabled="rule.isBuiltin || !hasAdminPerm('settings:edit')" @update:model-value="(v) => toggleEnabled(rule, v)" />
            </td>
            <td class="py-3 px-5 text-right">
              <template v-if="rule.isBuiltin">
                <span class="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded" title="主题代码注册，自动生效">
                  <UIcon name="ph:lock-simple-bold" class="w-3.5 h-3.5" />
                  已自动生效
                </span>
              </template>
              <template v-else>
                <UButton color="neutral" variant="ghost" icon="ph:pencil-simple" size="sm" @click="openEdit(rule)" :disabled="!hasAdminPerm('settings:edit')" />
                <UButton color="error" variant="ghost" icon="ph:trash" size="sm" @click="removeRule(rule)" :disabled="!hasAdminPerm('settings:edit')" />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit modal -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-lg' }">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ form.id ? '编辑规则' : '新建规则' }}</h3>

          <div>
            <label class="block text-xs text-gray-500 mb-1">事件</label>
            <USelect v-model="form.event" :items="eventOptions" class="w-full" />
          </div>

          <div>
            <label class="block text-xs text-gray-500 mb-1">动作</label>
            <USelect v-model="form.action" :items="actionOptions" class="w-full" />
          </div>

          <div>
            <label class="block text-xs text-gray-500 mb-1">执行模式</label>
            <USelect v-model="form.mode" :items="modeOptions" class="w-full" />
            <p v-if="form.mode === 'sync'" class="text-xs text-amber-500 dark:text-amber-400 mt-1.5 flex items-center gap-1">
              <UIcon name="ph:warning-circle-bold" class="w-3.5 h-3.5 shrink-0" />
              同步模式下，若此动作执行失败或超时，将直接拦截当前业务（如注册/支付）并向用户报错。
            </p>
          </div>

          <template v-if="form.action === 'grant_reward'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">奖励类型</label>
                <USelect v-model="form.balanceType" :items="balanceTypeOptions" class="w-full" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">{{ form.balanceType === 'points' ? '积分数量' : '金额($)' }}</label>
                <UInput v-model.number="form.amount" type="number" min="0" step="0.0001" class="w-full" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">备注(账单显示)</label>
              <UInput v-model="form.remark" placeholder="如:注册奖励" class="w-full" />
            </div>
          </template>

          <template v-else-if="form.action === 'send_webhook'">
            <div>
              <label class="block text-xs text-gray-500 mb-1">回调地址来源</label>
              <USelect v-model="form.urlMode" :items="urlModeOptions" class="w-full" />
            </div>
            <div v-if="form.urlMode === 'default'" class="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg text-xs text-gray-500 dark:text-gray-400">
              使用「系统设置 → 集成」中配置的默认 Webhook URL 与共享集成 Token。
            </div>
            <template v-else>
              <div>
                <label class="block text-xs text-gray-500 mb-1">自定义 Webhook URL</label>
                <UInput v-model="form.customUrl" placeholder="https://example.com/api/webhook" class="w-full" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">自定义鉴权 Token (可选)</label>
                <UInput v-model="form.customToken" type="password" placeholder="留空则使用系统默认集成 Token" class="w-full" />
              </div>
            </template>
            <div>
              <label class="block text-xs text-gray-500 mb-1">规则备注</label>
              <UInput v-model="form.remark" placeholder="如:新用户注册同步至 CRM" class="w-full" />
            </div>
          </template>

          <template v-else-if="selectedThemeAction">
            <div class="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl text-xs text-purple-700 dark:text-purple-300">
              <div class="font-semibold mb-1 flex items-center gap-1.5">
                <UIcon name="ph:sparkle-bold" class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                {{ selectedThemeAction.label }}
              </div>
              <p class="text-purple-600/90 dark:text-purple-300/90">{{ selectedThemeAction.description || '执行主题绑定的特定业务逻辑。' }}</p>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">规则备注</label>
              <UInput v-model="form.remark" placeholder="如:轻铺试用订单自动履约" class="w-full" />
            </div>
          </template>

          <div class="flex items-center gap-2">
            <USwitch v-model="form.enabled" />
            <span class="text-sm text-gray-600 dark:text-gray-300">启用</span>
          </div>

          <div v-if="formError" class="text-xs text-red-400">{{ formError }}</div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="modalOpen = false">取消</UButton>
            <UButton color="primary" :loading="saving" :disabled="!hasAdminPerm('settings:edit')" @click="save">保存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useFetch } from '#imports'

const { hasPerm: hasAdminPerm } = useAdminPermissions()

const { data: actionsData } = useFetch<any>('/api/admin/event-rules/actions', { default: () => ({ code: 0, data: { systemActions: [], themeActions: [] } }) })
const themeActions = computed(() => actionsData.value?.data?.themeActions || [])
const selectedThemeAction = computed(() => themeActions.value.find((t: any) => t.key === form.action) || null)

const eventOptions = [
  { label: '用户注册成功', value: 'user.registered' },
  { label: '订单支付成功', value: 'order.paid' },
  { label: '订阅生效', value: 'subscription.apply' },
]

const actionOptions = computed(() => {
  const baseActions = [
    { label: '发放奖励(积分/余额)', value: 'grant_reward' },
    { label: '发送 Webhook 回调', value: 'send_webhook' },
  ]
  const themeOpts = themeActions.value.map((t: any) => ({
    label: `[${t.theme || '主题'}] ${t.label || t.key}`,
    value: t.key,
  }))
  return [...baseActions, ...themeOpts]
})

const modeOptions = [
  { label: '异步执行 (推荐，后台非阻塞)', value: 'async' },
  { label: '同步执行 (强门禁，失败则拦截并报错)', value: 'sync' },
]
const balanceTypeOptions = [
  { label: '积分', value: 'points' },
  { label: '余额(充值)', value: 'cash' },
  { label: '赠送', value: 'grant' },
]
const urlModeOptions = [
  { label: '系统默认 (集成设置中的 Webhook URL)', value: 'default' },
  { label: '自定义 Webhook 地址', value: 'custom' },
]

const eventLabel = (v: string) => eventOptions.find(o => o.value === v)?.label || v
const actionLabel = (v: string) => actionOptions.value.find(o => o.value === v)?.label || v
const balanceTypeLabel = (v: string) => balanceTypeOptions.find(o => o.value === v)?.label || v

const configSummary = (rule: any) => {
  const c = rule.config || {}
  const modeTag = c.mode === 'sync' ? '[同步] ' : ''
  if (rule.action === 'grant_reward') {
    return modeTag + (c.balanceType === 'points'
      ? `发放 ${c.amount || 0} 积分`
      : `发放 $${c.amount || 0} ${balanceTypeLabel(c.balanceType)}`)
  }
  if (rule.action === 'send_webhook') {
    if (c.urlMode === 'custom') {
      return modeTag + `Webhook: ${c.customUrl || '(未配置地址)'}`
    }
    return modeTag + 'Webhook: 系统默认地址'
  }
  const matchedTheme = themeActions.value.find((t: any) => t.key === rule.action)
  if (matchedTheme) {
    return modeTag + (matchedTheme.label || rule.action)
  }
  if (rule.action === 'qingpu:fulfill_trial') {
    return modeTag + '轻铺：试用订单履约与权益开通'
  }
  return modeTag + (rule.action || JSON.stringify(rule.config || {}))
}

const { data, pending, refresh } = useFetch<any[]>('/api/admin/event-rules', { default: () => [] })
const rules = computed(() => data.value || [])
const builtinRules = computed(() => rules.value.filter((r: any) => r.isBuiltin))

const modalOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive<any>({
  id: null,
  event: 'user.registered',
  action: 'grant_reward',
  mode: 'async',
  balanceType: 'points',
  amount: 1000,
  urlMode: 'default',
  customUrl: '',
  customToken: '',
  remark: '注册奖励',
  enabled: true,
})

const openCreate = () => {
  Object.assign(form, {
    id: null,
    event: 'user.registered',
    action: 'grant_reward',
    mode: 'async',
    balanceType: 'points',
    amount: 1000,
    urlMode: 'default',
    customUrl: '',
    customToken: '',
    remark: '注册奖励',
    enabled: true,
  })
  formError.value = ''
  modalOpen.value = true
}

const openEdit = (rule: any) => {
  const c = rule.config || {}
  Object.assign(form, {
    id: rule.id,
    event: rule.event,
    action: rule.action,
    mode: c.mode || 'async',
    balanceType: c.balanceType || 'points',
    amount: Number(c.amount || 0),
    urlMode: c.urlMode || 'default',
    customUrl: c.customUrl || '',
    customToken: c.customToken || '',
    remark: c.remark || rule.remark || '',
    enabled: !!rule.enabled,
  })
  formError.value = ''
  modalOpen.value = true
}

const buildPayload = () => {
  let config: Record<string, any> = {
    mode: form.mode || 'async',
  }
  if (form.action === 'grant_reward') {
    Object.assign(config, {
      balanceType: form.balanceType,
      amount: Number(form.amount) || 0,
      remark: form.remark,
    })
  } else if (form.action === 'send_webhook') {
    Object.assign(config, {
      urlMode: form.urlMode,
      customUrl: form.urlMode === 'custom' ? String(form.customUrl || '').trim() : '',
      customToken: form.urlMode === 'custom' ? String(form.customToken || '').trim() : '',
    })
  }

  return {
    event: form.event,
    action: form.action,
    enabled: form.enabled,
    remark: form.remark,
    config,
  }
}

const save = async () => {
  if (form.action === 'grant_reward' && (!form.amount || Number(form.amount) <= 0)) {
    formError.value = '奖励数量必须大于 0'
    return
  }
  if (form.action === 'send_webhook' && form.urlMode === 'custom') {
    const trimmedUrl = String(form.customUrl || '').trim()
    if (!trimmedUrl) {
      formError.value = '请输入自定义 Webhook URL'
      return
    }
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      formError.value = 'Webhook URL 格式不正确（必须以 http:// 或 https:// 开头）'
      return
    }
  }
  saving.value = true
  try {
    if (form.id) {
      await $fetch(`/api/admin/event-rules/${form.id}`, { method: 'PUT', body: buildPayload() })
    } else {
      await $fetch('/api/admin/event-rules', { method: 'POST', body: buildPayload() })
    }
    modalOpen.value = false
    await refresh()
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || e?.statusMessage || '保存失败'
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (rule: any, value: boolean) => {
  try {
    await $fetch(`/api/admin/event-rules/${rule.id}`, { method: 'PUT', body: { enabled: value } })
  } finally {
    await refresh()
  }
}

const removeRule = async (rule: any) => {
  if (!confirm('确定删除该规则?')) return
  try {
    await $fetch(`/api/admin/event-rules/${rule.id}`, { method: 'DELETE' })
  } finally {
    await refresh()
  }
}
</script>
