<template>
  <aside class="admin-sidebar-scrollbar sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-10 pr-6 md:block">
    <div class="space-y-8">
      <div>
        <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(storeSection) }}</h3>
        <nav class="space-y-1">
          <template v-for="item in storeSection.items" :key="item.to">
            <NuxtLink
              v-if="!item.conditional || item.conditional()"
              :to="item.to"
              :class="adminDesktopNavItemClass"
              :active-class="adminNavActiveClass"
              :exact-active-class="item.exact ? adminNavActiveClass : undefined"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="item.icon"
                  class="w-4 h-4"
                  :class="item.to === '/admin/themes' ? 'text-purple-400' : ''"
                />
                {{ resolveLabel(item) }}
              </div>
            </NuxtLink>
          </template>
        </nav>
      </div>

      <div v-if="extensionPages.length">
        <h3 :class="adminSectionTitleClass">{{ themeSectionTitle }}</h3>
        <nav class="space-y-1">
          <NuxtLink
            v-for="page in extensionPages"
            :key="page.key"
            :to="page.route"
            :class="adminDesktopNavItemClass"
            :exact-active-class="adminNavActiveClass"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="page.icon"
                class="w-4 h-4"
              />
              {{ page.title }}
            </div>
          </NuxtLink>
        </nav>
      </div>

      <div>
        <h3 :class="adminSectionTitleClass">{{ resolveSectionTitle(configSection) }}</h3>
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in configSection.items"
            :key="item.to"
            :to="item.to"
            :class="adminDesktopNavItemClass"
            :active-class="adminNavActiveClass"
          >
            <div class="flex items-center gap-2">
              <Icon
                :name="item.icon"
                class="w-4 h-4"
                :class="item.to === '/admin/themes' ? 'text-purple-400' : ''"
              />
              {{ resolveLabel(item) }}
            </div>
          </NuxtLink>
        </nav>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

const { extensionPages, themeSectionTitle } = useAdminExtensions()
const { storeSection, configSection, resolveLabel, resolveSectionTitle, loadProductTypes } = useAdminNav()
const {
  adminSectionTitleClass,
  adminDesktopNavItemClass,
  adminNavActiveClass,
} = useAdminNavStyle()

onMounted(async () => {
  await loadProductTypes()
})
</script>

<style scoped>
.admin-sidebar-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.7) transparent;
}

.admin-sidebar-scrollbar::-webkit-scrollbar {
  width: 10px;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.7);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.admin-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.9);
}

:global(.dark) .admin-sidebar-scrollbar {
  scrollbar-color: rgba(75, 85, 99, 0.85) transparent;
}

:global(.dark) .admin-sidebar-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.85);
}

:global(.dark) .admin-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.95);
}
</style>
