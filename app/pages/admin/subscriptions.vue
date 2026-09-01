<template>
  <div class="flex h-[calc(100vh-10rem)] flex-col">
    <div class="mb-6 flex shrink-0 items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ t('admin.subscriptions.title', '订阅管理') }}</h1>
        <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{{ t('admin.subscriptions.subtitle', '查看与管理客户周期性订阅计划') }}</p>
      </div>
      <NuxtLink to="/admin/products" class="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
        <UIcon name="ph:arrow-left" class="w-3.5 h-3.5" />
        <span>返回产品管理</span>
      </NuxtLink>
    </div>

    <AdminSubscriptionsPanel />
  </div>
</template>

<script setup lang="ts">
import { definePageMeta, useI18n } from '#imports'
import AdminSubscriptionsPanel from '~/components/AdminSubscriptionsPanel.vue'

definePageMeta({ title: 'Subscriptions Management', layout: 'admin' })
const { t } = useI18n()
</script>
