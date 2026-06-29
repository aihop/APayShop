<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">事件自动化</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">配置某个事件发生后自动执行的动作,例如「用户注册成功 → 发放积分奖励」。</p>
      </div>
      <UButton
        color="primary"
        class="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
        icon="ph:plus-bold"
        @click="openCreate"
      >新建规则</UButton>
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
            <th class="text-left font-medium py-3 px-5">动作</th>
            <th class="text-left font-medium py-3 px-5">配置</th>
            <th class="text-left font-medium py-3 px-5">状态</th>
            <th class="text-right font-medium py-3 px-5">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rule in rules"
            :key="rule.id"
            class="border-b border-gray-100 dark:border-gray-800/50"
          >
            <td class="py-3 px-5 text-gray-900 dark:text-white">{{ eventLabel(rule.event) }}</td>
            <td class="py-3 px-5 text-gray-700 dark:text-gray-200">{{ actionLabel(rule.action) }}</td>
            <td class="py-3 px-5 text-gray-500 dark:text-gray-400">{{ configSummary(rule) }}</td>
            <td class="py-3 px-5">
              <USwitch :model-value="rule.enabled" @update:model-value="(v) => toggleEnabled(rule, v)" />
            </td>
            <td class="py-3 px-5 text-right">
              <UButton color="neutral" variant="ghost" icon="ph:pencil-simple" size="sm" @click="openEdit(rule)" />
              <UButton color="error" variant="ghost" icon="ph:trash" size="sm" @click="removeRule(rule)" />
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

          <div class="flex items-center gap-2">
            <USwitch v-model="form.enabled" />
            <span class="text-sm text-gray-600 dark:text-gray-300">启用</span>
          </div>

          <div v-if="formError" class="text-xs text-red-400">{{ formError }}</div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="modalOpen = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="save">保存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useFetch } from '#imports'

const eventOptions = [
  { label: '用户注册成功', value: 'user.registered' },
  { label: '订单支付成功', value: 'order.paid' },
  { label: '订阅生效', value: 'subscription.apply' },
]
const actionOptions = [
  { label: '发放奖励(积分/余额)', value: 'grant_reward' },
]
const balanceTypeOptions = [
  { label: '积分', value: 'points' },
  { label: '余额(充值)', value: 'cash' },
  { label: '赠送', value: 'grant' },
]

const eventLabel = (v: string) => eventOptions.find(o => o.value === v)?.label || v
const actionLabel = (v: string) => actionOptions.find(o => o.value === v)?.label || v
const balanceTypeLabel = (v: string) => balanceTypeOptions.find(o => o.value === v)?.label || v

const configSummary = (rule: any) => {
  if (rule.action === 'grant_reward') {
    const c = rule.config || {}
    return c.balanceType === 'points'
      ? `发放 ${c.amount || 0} 积分`
      : `发放 $${c.amount || 0} ${balanceTypeLabel(c.balanceType)}`
  }
  return JSON.stringify(rule.config || {})
}

const { data, pending, refresh } = useFetch<any[]>('/api/admin/event-rules', { default: () => [] })
const rules = computed(() => data.value || [])

const modalOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive<any>({
  id: null,
  event: 'user.registered',
  action: 'grant_reward',
  balanceType: 'points',
  amount: 1000,
  remark: '注册奖励',
  enabled: true,
})

const openCreate = () => {
  Object.assign(form, { id: null, event: 'user.registered', action: 'grant_reward', balanceType: 'points', amount: 1000, remark: '注册奖励', enabled: true })
  formError.value = ''
  modalOpen.value = true
}

const openEdit = (rule: any) => {
  const c = rule.config || {}
  Object.assign(form, {
    id: rule.id,
    event: rule.event,
    action: rule.action,
    balanceType: c.balanceType || 'points',
    amount: Number(c.amount || 0),
    remark: c.remark || rule.remark || '',
    enabled: !!rule.enabled,
  })
  formError.value = ''
  modalOpen.value = true
}

const buildPayload = () => ({
  event: form.event,
  action: form.action,
  enabled: form.enabled,
  remark: form.remark,
  config: form.action === 'grant_reward'
    ? { balanceType: form.balanceType, amount: Number(form.amount) || 0, remark: form.remark }
    : {},
})

const save = async () => {
  if (form.action === 'grant_reward' && (!form.amount || Number(form.amount) <= 0)) {
    formError.value = '奖励数量必须大于 0'
    return
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
