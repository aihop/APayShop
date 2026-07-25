<template>
  <div class="bg-white dark:bg-[#121214] border border-gray-200/60 dark:border-gray-800/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
    <div class="flex-1 overflow-auto">
      <slot />
    </div>

    <div class="p-4 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between shrink-0 bg-white dark:bg-[#121214] rounded-b-2xl">
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('admin.common.showing') }} {{ rowCount > 0 ? (page - 1) * pageSize + 1 : 0 }}
        {{ $t('admin.common.to') }}
        {{ Math.min(page * pageSize, total) }}
        {{ $t('admin.common.of') }} {{ total }}
        {{ $t('admin.common.results') }}
      </span>
      <UPagination
        :model-value="page"
        :total="total"
        :page-count="pageSize"
        :max="5"
        @update:page="(val: number) => emit('update:page', val)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/** Scrollable table surface + pagination footer, shared by all three log tabs. */
defineProps<{
  page: number
  pageSize: number
  total: number
  rowCount: number
}>()

const emit = defineEmits<{ 'update:page': [value: number] }>()
</script>
