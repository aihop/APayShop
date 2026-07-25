<template>
  <div class="min-h-screen bg-[#050505] pt-32 pb-20 px-6">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">{{ titleLabel }}</h1>
          <p class="text-gray-400">{{ subtitleLabel }}</p>
        </div>
        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 text-white font-medium"
          icon="ph:plus-bold"
          @click="openCreateModal"
        >{{ createLabel }}</UButton>
      </div>

      <!-- List -->
      <div
        v-if="pending"
        class="space-y-4"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="h-20 bg-[#0A0A0A] border border-white/5 rounded-2xl animate-pulse"
        ></div>
      </div>

      <div
        v-else-if="tokens.length"
        class="space-y-4"
      >
        <div
          v-for="tok in tokens"
          :key="tok.id"
          class="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-white font-medium truncate">{{ tok.name || untitledLabel }}</span>
              <UBadge
                :color="statusColor(tok)"
                variant="subtle"
                size="sm"
              >{{ statusLabel(tok) }}</UBadge>
            </div>
            <div class="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{{ createdLabel }}: {{ formatDate(tok.createdAt) }}</span>
              <span>{{ lastUsedLabel }}: {{ tok.lastUsedAt ? formatDate(tok.lastUsedAt) : neverLabel }}</span>
              <span>{{ expiresLabel }}: {{ tok.expiresAt ? formatDate(tok.expiresAt) : neverLabel }}</span>
            </div>
          </div>
          <UButton
            v-if="!tok.revoked"
            color="error"
            variant="outline"
            size="sm"
            @click="revokeToken(tok)"
          >{{ revokeLabel }}</UButton>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="bg-[#0A0A0A] border border-white/5 rounded-3xl py-24 text-center"
      >
        <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <UIcon
            name="ph:key"
            class="w-10 h-10 text-gray-500"
          />
        </div>
        <h3 class="text-xl font-bold text-white mb-2">{{ emptyTitleLabel }}</h3>
        <p class="text-gray-400 mb-8 max-w-md mx-auto">{{ emptyDescLabel }}</p>
        <UButton
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 font-medium px-6 py-2 rounded-full"
          @click="openCreateModal"
        >{{ createLabel }}</UButton>
      </div>
    </div>

    <!-- Create modal -->
    <UModal
      v-model:open="isCreateModalOpen"
      :ui="{ content: 'bg-[#0A0A0A] border border-white/10' }"
    >
      <template #content>
        <div class="p-6">
          <h3 class="text-xl font-bold text-white mb-6">{{ createLabel }}</h3>
          <form
            @submit.prevent="createToken"
            class="space-y-5"
          >
            <UFormField :label="nameLabel">
              <UInput
                v-model="createForm.name"
                required
                :placeholder="namePlaceholder"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="expiresLabel">
              <USelect
                v-model="createForm.expiresInDays"
                :items="expiryOptions"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="isCreateModalOpen = false"
              >{{ cancelLabel }}</UButton>
              <UButton
                type="submit"
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white"
                :loading="isCreating"
              >{{ createLabel }}</UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Reveal-once modal -->
    <UModal
      v-model:open="isRevealModalOpen"
      :ui="{ content: 'bg-[#0A0A0A] border border-white/10' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex items-start gap-3 mb-5">
            <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
              <UIcon name="ph:warning-fill" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-white">{{ revealTitleLabel }}</h3>
              <p class="text-sm text-gray-400 mt-1">{{ revealDescLabel }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
            <code class="text-sm text-emerald-400 font-mono break-all flex-1">{{ revealedToken }}</code>
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:copy"
              size="sm"
              @click="copyRevealedToken"
            />
          </div>
          <div class="flex justify-end pt-6">
            <UButton
              color="primary"
              class="bg-purple-600 hover:bg-purple-500 text-white"
              @click="isRevealModalOpen = false"
            >{{ doneLabel }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

const { getSetting } = useSettings()
const { formatDate } = useFormatTime()
const { locale } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

useHead({
  title: `API Tokens - ${getSetting('site_name')}`,
})

const isZh = computed(() => locale.value.startsWith('zh'))
const titleLabel = computed(() => (isZh.value ? 'API Token' : 'API Tokens'))
const subtitleLabel = computed(() => (isZh.value ? '生成用于程序化访问的令牌，可以在自己的脚本或集成里调用接口。' : 'Generate tokens for programmatic access — use them from your own scripts or integrations.'))
const createLabel = computed(() => (isZh.value ? '新建 Token' : 'Create Token'))
const untitledLabel = computed(() => (isZh.value ? '未命名' : 'Untitled'))
const createdLabel = computed(() => (isZh.value ? '创建于' : 'Created'))
const lastUsedLabel = computed(() => (isZh.value ? '最近使用' : 'Last used'))
const expiresLabel = computed(() => (isZh.value ? '过期时间' : 'Expires'))
const neverLabel = computed(() => (isZh.value ? '从未 / 永不' : 'Never'))
const revokeLabel = computed(() => (isZh.value ? '吊销' : 'Revoke'))
const emptyTitleLabel = computed(() => (isZh.value ? '还没有 Token' : 'No tokens yet'))
const emptyDescLabel = computed(() => (isZh.value ? '创建一个 Token，就可以在脚本里用 Authorization: Bearer 头调用接口了。' : 'Create a token to call the API from your own scripts with an Authorization: Bearer header.'))
const nameLabel = computed(() => (isZh.value ? '名称' : 'Name'))
const namePlaceholder = computed(() => (isZh.value ? '例如：我的自动化脚本' : 'e.g. My automation script'))
const cancelLabel = computed(() => (isZh.value ? '取消' : 'Cancel'))
const revealTitleLabel = computed(() => (isZh.value ? '保存好这个 Token' : 'Save this token'))
const revealDescLabel = computed(() => (isZh.value ? '现在复制它——出于安全考虑，关闭这个窗口后就再也看不到完整内容了。' : 'Copy it now — for security, you won’t be able to see the full value again after closing this.'))
const doneLabel = computed(() => (isZh.value ? '我已保存' : 'Done, I saved it'))

const expiryOptions = computed(() => [
  { label: isZh.value ? '永不过期' : 'Never expires', value: 'never' },
  { label: isZh.value ? '30 天' : '30 days', value: '30' },
  { label: isZh.value ? '90 天' : '90 days', value: '90' },
  { label: isZh.value ? '365 天' : '365 days', value: '365' },
])

const {
  data: tokensData,
  pending,
  refresh,
} = await useFetch<any>('/api/users/tokens', {
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/login')
    }
  },
})

const tokens = computed(() => tokensData.value?.data || [])

const isExpired = (tok: any) => !!tok.expiresAt && new Date(tok.expiresAt).getTime() < Date.now()

const statusColor = (tok: any): any => {
  if (tok.revoked) return 'neutral'
  if (isExpired(tok)) return 'warning'
  return 'success'
}
const statusLabel = (tok: any) => {
  if (tok.revoked) return isZh.value ? '已吊销' : 'Revoked'
  if (isExpired(tok)) return isZh.value ? '已过期' : 'Expired'
  return isZh.value ? '有效' : 'Active'
}

const isCreateModalOpen = ref(false)
const isCreating = ref(false)
const createForm = reactive({
  name: '',
  expiresInDays: 'never',
})

const openCreateModal = () => {
  createForm.name = ''
  createForm.expiresInDays = 'never'
  isCreateModalOpen.value = true
}

const isRevealModalOpen = ref(false)
const revealedToken = ref('')

const createToken = async () => {
  isCreating.value = true
  try {
    const res: any = await $fetch('/api/users/tokens', {
      method: 'POST',
      body: {
        name: createForm.name,
        expiresInDays: createForm.expiresInDays === 'never' ? null : Number(createForm.expiresInDays),
      },
    })
    isCreateModalOpen.value = false
    revealedToken.value = res.token
    isRevealModalOpen.value = true
    await refresh()
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || (isZh.value ? '创建失败' : 'Failed to create token'),
      color: 'error',
    })
  } finally {
    isCreating.value = false
  }
}

const copyRevealedToken = () => {
  if (!revealedToken.value) return
  navigator.clipboard.writeText(revealedToken.value)
  toast.add({ title: isZh.value ? '已复制' : 'Copied', color: 'success' })
}

const revokeToken = async (tok: any) => {
  const isConfirmed = await confirm({
    title: revokeLabel.value,
    description: isZh.value
      ? `确定要吊销「${tok.name || untitledLabel.value}」吗？用它签名的请求会立刻失效。`
      : `Revoke "${tok.name || untitledLabel.value}"? Any request signed with it will stop working immediately.`,
  })
  if (!isConfirmed) return

  try {
    await $fetch(`/api/users/tokens/${tok.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: isZh.value ? '已吊销' : 'Revoked', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: isZh.value ? '错误' : 'Error',
      description: e.data?.message || (isZh.value ? '吊销失败' : 'Failed to revoke token'),
      color: 'error',
    })
  }
}
</script>
