<template>
  <div class="flex h-[calc(100vh-10rem)] flex-col">
    <div class="mb-6 flex shrink-0 items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ t('admin.cards.title', '卡密库存') }}</h1>
        <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{{ t('admin.cards.subtitle', '管理卡密型商品的导入与使用状态') }}</p>
      </div>
      <NuxtLink to="/admin/products" class="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
        <UIcon name="ph:arrow-left" class="w-3.5 h-3.5" />
        <span>返回产品管理</span>
      </NuxtLink>
    </div>

    <AdminCardsPanel />
  </div>
</template>

<script setup lang="ts">
import { definePageMeta, useI18n } from '#imports'
import AdminCardsPanel from '~/components/AdminCardsPanel.vue'

definePageMeta({ title: 'Cards Management', layout: 'admin' })
const { t } = useI18n()
</script>
