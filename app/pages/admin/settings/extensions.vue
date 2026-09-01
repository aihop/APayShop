<template>
  <div class="mx-auto pb-12">
    <div class="mb-8">
      <h1 class="flex items-center gap-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        <UIcon name="ph:puzzle-piece-fill" class="h-8 w-8 text-purple-500" />
        {{ $t('admin.extensions.title') }}
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ $t('admin.extensions.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <AdminSettingsNav active="extensions" @select="goToSettingsTab" />
      <div class="space-y-4 lg:col-span-9">
        <div
          v-for="extension in extensions"
          :key="extension.id"
          class="flex items-start justify-between gap-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800/60 dark:bg-[#121214]"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">{{ extension.name }}</h2>
              <UBadge color="neutral" variant="subtle">v{{ extension.version }}</UBadge>
              <UBadge :color="statusColor(extension.id)" variant="subtle">
                {{ $t(`admin.extensions.status.${migrationStatus(extension.id).state}`) }}
              </UBadge>
            </div>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ extension.description }}</p>
            <code class="mt-3 block text-xs text-gray-400">{{ extension.id }}</code>
            <p v-if="migrationStatus(extension.id).migrations.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('admin.extensions.migrationSummary', {
                applied: migrationStatus(extension.id).migrations.filter(item => item.state === 'applied').length,
                total: migrationStatus(extension.id).migrations.length,
                dialect: migrationStatus(extension.id).dialect,
              }) }}
            </p>
            <UButton
              v-if="migrationStatus(extension.id).state !== 'ready' && migrationStatus(extension.id).state !== 'checksum_mismatch'"
              class="mt-4"
              color="warning"
              variant="soft"
              size="sm"
              icon="ph:database"
              :loading="migrating === extension.id"
              :disabled="!hasAdminPerm('settings:edit') || !!migrating"
              @click="migrate(extension.id)"
            >{{ $t('admin.extensions.migrate') }}</UButton>
          </div>
          <USwitch
            :model-value="selected.has(extension.id)"
            :disabled="!hasAdminPerm('settings:edit') || saving || (!selected.has(extension.id) && migrationStatus(extension.id).state !== 'ready')"
            @update:model-value="toggle(extension.id, $event)"
          />
        </div>

        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="saving"
            :disabled="!hasAdminPerm('settings:edit')"
            @click="save"
          >{{ $t('admin.extensions.save') }}</UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isSettingsTabId } from '~/components/admin/settings/nav-tabs'

definePageMeta({ title: 'Extensions', layout: 'admin' })

const toast = useToast()
const { t } = useI18n()
const { hasPerm: hasAdminPerm } = useAdminPermissions()
const { fetchSettings } = useSettings()
const saving = ref(false)
const migrating = ref('')
const selected = ref(new Set<string>())

type ExtensionMigrationStatus = {
  dialect: 'sqlite' | 'postgresql' | 'mysql'
  state: 'pending' | 'ready' | 'failed' | 'checksum_mismatch'
  migrations: Array<{ id: string, checksum: string, state: 'pending' | 'applied' | 'checksum_mismatch' }>
  failure: { migrationId: string, failedAt: string } | null
}

type ExtensionSettingsResponse = {
  extensions: Array<{ id: string; name: string; description: string; version: string }>
  enabled: string[]
  migrationStatuses: Record<string, ExtensionMigrationStatus>
}

const fetchExtensionSettings = $fetch as unknown as (
  request: '/api/admin/settings/extensions',
) => Promise<ExtensionSettingsResponse>
const { data, refresh } = await useAsyncData('extension-settings', () => fetchExtensionSettings('/api/admin/settings/extensions'))
const extensions = computed(() => data.value?.extensions || [])
selected.value = new Set(data.value?.enabled || [])

const emptyStatus = (): ExtensionMigrationStatus => ({
  dialect: 'sqlite',
  state: 'ready',
  migrations: [],
  failure: null,
})
const migrationStatus = (id: string) => data.value?.migrationStatuses[id] || emptyStatus()
const statusColor = (id: string) => {
  const state = migrationStatus(id).state
  if (state === 'ready') return 'success'
  if (state === 'pending') return 'warning'
  return 'error'
}

const goToSettingsTab = (tabId: string) => {
  if (isSettingsTabId(tabId)) navigateTo({ path: '/admin/settings', query: { tab: tabId } })
}

const toggle = (id: string, enabled: boolean) => {
  const next = new Set(selected.value)
  if (enabled) next.add(id)
  else next.delete(id)
  selected.value = next
}

const migrate = async (id: string) => {
  migrating.value = id
  try {
    await $fetch('/api/admin/settings/extensions', {
      method: 'POST',
      body: { action: 'migrate', extension: id },
    })
    await refresh()
    toast.add({ title: t('admin.extensions.migrated'), color: 'success' })
  } catch (error: unknown) {
    const failure = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: t('admin.extensions.migrateFailed'),
      description: failure.data?.message || failure.message,
      color: 'error',
    })
    await refresh()
  } finally {
    migrating.value = ''
  }
}

const save = async () => {
  saving.value = true
  try {
    await $fetch('/api/admin/settings/extensions', {
      method: 'POST',
      body: { enabled: [...selected.value] },
    })
    await fetchSettings(true)
    toast.add({ title: t('admin.extensions.saved'), color: 'success' })
  } catch (error: unknown) {
    const failure = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: t('admin.extensions.saveFailed'),
      description: failure.data?.message || failure.message,
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>
