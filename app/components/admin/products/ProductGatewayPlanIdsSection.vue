<template>
  <div
    v-if="visible"
    class="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-[#1a1a1c] mt-4"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-gray-900 dark:text-white font-medium flex items-center gap-2">
        <UIcon
          name="ph:plugs-connected"
          class="text-green-400"
        />
        {{ $t('admin.products.form.gateway_plan_ids') }}
      </h3>
    </div>
    <p class="text-xs text-gray-400 mb-4">{{ $t('admin.products.form.gateway_description') }}</p>
    <div class="space-y-3">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-3"
      >
        <USelect
          v-model="item.gateway"
          :items="availableGateways"
          :placeholder="$t('admin.products.form.select_gateway')"
          class="w-1/3"
        />
        <UInput
          v-model="item.id"
          :placeholder="$t('admin.products.form.plan_id_placeholder')"
          class="flex-1 text-gray-900 dark:text-white"
        />
        <UButton
          color="error"
          variant="ghost"
          icon="ph:trash"
          @click="emit('remove', index)"
        />
      </div>
      <UButton
        color="neutral"
        variant="outline"
        icon="ph:plus"
        size="sm"
        class="w-full border-dashed"
        @click="emit('add')"
      >
        {{ $t('admin.products.form.add_gateway_mapping') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  items: Array<{ gateway: string, id: string }>
  availableGateways: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()
</script>
