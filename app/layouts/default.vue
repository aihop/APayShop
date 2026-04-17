<template>
  <component
    :is="activeLayout"
    :key="activeTheme"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

const { getSetting } = useSettings()

const route = useRoute()

const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

const activeTheme = computed(() => getSetting('active_theme') || 'default')

const isAdminRoute = computed(
  () => {
    const path = normalizeAdminPath(route.path)
    return path.startsWith('/admin') && path !== '/admin/login'
  }
)

// Dynamic layout loader
const activeLayout = computed(() => {
  // Always use the default admin layout for backend routes
  if (isAdminRoute.value) {
    return defineAsyncComponent(
      () => import('../themes/default/layouts/default.vue')
    )
  }

  return defineAsyncComponent(() =>
    import(`../themes/${activeTheme.value}/layouts/default.vue`).catch(() => {
      return import('../themes/default/layouts/default.vue')
    })
  )
})
</script>
