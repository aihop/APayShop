<template>
  <div>
    <UButton
      color="neutral"
      variant="ghost"
      class="text-gray-400 hover:text-white"
      @click="isOpen = true"
    >
      <template #leading>
        <UIcon
          name="ph:magnifying-glass"
          class="w-5 h-5"
        />
      </template>
      <span class="hidden md:inline-block text-sm font-medium">Search Routes</span>
      <template #trailing>
        <div class="hidden lg:flex items-center gap-1">
          <UKbd>⌘</UKbd>
          <UKbd>K</UKbd>
        </div>
      </template>
    </UButton>

    <UModal v-model:open="isOpen">
      <template #content>
        <UCommandPalette
          v-model="selected"
          :groups="groups"
          :autoselect="false"
          placeholder="Search pages and settings..."
          class="h-80 bg-[#121214] ring-1 ring-gray-800"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const isOpen = ref(false)
const selected = ref<any>(null)
const router = useRouter()
const { t } = useI18n()
const { extensionPages } = useAdminExtensions()

// Define keyboard shortcut to open palette
defineShortcuts({
  meta_k: () => {
    isOpen.value = true
  },
})

const routes = computed(() => {
  const coreRoutes = [
    { id: 'home', label: 'Home', icon: 'ph:house', to: '/' },
    { id: 'products', label: 'Products', icon: 'ph:package', to: '/products' },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: 'ph:currency-circle-dollar',
      to: '/pricing',
    },
    { id: 'about', label: 'About Us', icon: 'ph:info', to: '/about' },
    { id: 'contact', label: 'Contact', icon: 'ph:envelope', to: '/contact' },
    {
      id: 'admin-dashboard',
      label: t('admin.nav.dashboard'),
      icon: 'ph:squares-four',
      to: '/admin',
    },
    {
      id: 'admin-orders',
      label: t('admin.nav.orders'),
      icon: 'ph:shopping-cart',
      to: '/admin/orders',
    },
    {
      id: 'admin-stats',
      label: t('admin.nav.stats'),
      icon: 'ph:chart-bar',
      to: '/admin/stats',
    },
    {
      id: 'admin-products',
      label: t('admin.nav.products'),
      icon: 'ph:package',
      to: '/admin/products',
    },
    {
      id: 'admin-customers',
      label: t('admin.nav.customers'),
      icon: 'ph:users',
      to: '/admin/customers',
    },
    {
      id: 'admin-posts',
      label: t('admin.nav.blogs'),
      icon: 'lucide:newspaper',
      to: '/admin/posts',
    },
    {
      id: 'admin-cards',
      label: 'Cards',
      icon: 'ph:barcode',
      to: '/admin/cards',
    },
    {
      id: 'admin-subscriptions',
      label: 'Subscriptions',
      icon: 'ph:calendar-check',
      to: '/admin/subscriptions',
    },
    {
      id: 'admin-apikeys',
      label: 'API Keys',
      icon: 'ph:key',
      to: '/admin/api-keys',
    },
    {
      id: 'admin-failures',
      label: t('admin.nav.failures'),
      icon: 'ph:warning-circle',
      to: '/admin/failures',
    },
    {
      id: 'admin-payments',
      label: t('admin.nav.payments'),
      icon: 'ph:credit-card',
      to: '/admin/payments',
    },
    {
      id: 'admin-users',
      label: t('admin.nav.admins'),
      icon: 'ph:users-three',
      to: '/admin/users',
    },
    {
      id: 'admin-logs',
      label: t('admin.nav.logs'),
      icon: 'ph:log',
      to: '/admin/logs',
    },
    {
      id: 'admin-themes',
      label: t('admin.nav.themes'),
      icon: 'i-heroicons-sparkles',
      to: '/admin/themes',
    },
    {
      id: 'admin-settings',
      label: t('admin.nav.general'),
      icon: 'ph:gear',
      to: '/admin/settings',
    },
  ]

  const themeRoutes = extensionPages.value.map((page: any) => ({
    id: `theme-extension-${page.key}`,
    label: page.title,
    icon: page.icon,
    to: page.route,
  }))

  return [...coreRoutes, ...themeRoutes]
})

const groups = computed(() => [
  {
    id: 'routes',
    label: 'Routes',
    items: routes.value,
  },
])

// Handle selection
watch(selected, (item: any) => {
  if (item && item.to) {
    isOpen.value = false
    router.push(item.to)
    selected.value = null // reset selection
  }
})
</script>
