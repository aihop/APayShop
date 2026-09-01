<template>
  <div class="h-[calc(100vh-7rem)] flex flex-col">
    <div class="flex justify-between items-end mb-8 shrink-0">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ headerTitle }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ headerSubtitle }}</p>
      </div>
      <!-- Each tab teleports its own header actions in here, so this page owns
           the layout and knows nothing about what any individual tab can do. -->
      <div id="logs-header-actions" />
    </div>

    <UTabs v-model="tab" :items="tabItems" class="mb-4" />

    <AdminLogsSystemTab v-if="tab === 'system'" />
    <AdminLogsAccessTab v-else-if="tab === 'access'" />
    <AdminLogsOperationTab v-else-if="tab === 'operation'" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ title: 'Logs', layout: 'admin' })
const { t } = useI18n()
const route = useRoute()

const TABS = ['system', 'access', 'operation'] as const
type LogTab = typeof TABS[number]

const tab = ref<LogTab>(
  TABS.includes(route.query.tab as LogTab) ? (route.query.tab as LogTab) : 'system'
)

const TAB_I18N_ROOT: Record<LogTab, string> = {
  system: 'admin.logs',
  access: 'admin.accessLogs',
  operation: 'admin.operationLogs',
}

const tabItems = computed(() => [
  { label: t('admin.logs.page.title'), icon: 'ph:terminal-window', value: 'system' },
  { label: t('admin.accessLogs.page.title'), icon: 'ph:binoculars', value: 'access' },
  { label: t('admin.operationLogs.page.title'), icon: 'ph:clipboard-text', value: 'operation' },
])

const headerTitle = computed(() => t(`${TAB_I18N_ROOT[tab.value]}.page.title`))
const headerSubtitle = computed(() => t(`${TAB_I18N_ROOT[tab.value]}.page.subtitle`))
</script>
