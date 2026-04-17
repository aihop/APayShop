<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Themes</h1>
        <p class="text-gray-400 mt-2 text-sm">Manage your storefront appearance and layout.</p>
      </div>
      <UButton
        to="/admin/themes/builder"
        color="primary"
        variant="solid"
        icon="i-heroicons-sparkles"
        class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg"
      >
        AI Theme Builder
      </UButton>
    </div>

    <!-- Active Theme Settings Link -->
    <div
      id="active-theme-section"
      class="bg-[#121214] border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.05)] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-700"
    >
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
          <UIcon
            name="ph:paint-brush-broad-fill"
            class="w-6 h-6"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white">Active Theme Configuration</h3>
          <p class="text-sm text-gray-400">Customize layout, colors, and features for your currently active theme ({{ getSetting('active_theme') || 'default' }}).</p>
        </div>
      </div>
      <UButton
        :to="`/admin/themes/${getSetting('active_theme') || 'default'}`"
        color="primary"
        variant="outline"
        class="shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] transition-all"
        size="lg"
      >
        Configure Active Theme
        <template #trailing>
          <UIcon name="ph:sliders-horizontal" />
        </template>
      </UButton>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div
        v-for="theme in themes || []"
        :key="theme.id"
        class="group bg-[#121214] border border-gray-800/60 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-colors flex flex-col"
        :class="{ 'ring-2 ring-purple-500 border-transparent': getSetting('active_theme') === theme.id }"
      >
        <div class="aspect-video bg-gray-900 relative overflow-hidden">
          <img
            v-if="theme.image"
            :src="theme.image"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-gray-700"
          >
            <UIcon
              name="ph:image"
              class="w-12 h-12"
            />
          </div>

          <div
            v-if="getSetting('active_theme') === theme.id"
            class="absolute top-3 right-3 bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5"
          >
            <UIcon name="ph:check-circle-fill" /> Active
          </div>
        </div>

        <div class="p-5 flex flex-col flex-1">
          <h3 class="text-lg font-semibold text-white">{{ theme.name }}</h3>
          <p class="text-sm text-gray-400 mt-1 line-clamp-2 flex-1">{{ theme.description }}</p>

          <div class="mt-5 pt-5 border-t border-gray-800 flex items-center justify-between">
            <UButton
              v-if="getSetting('active_theme') !== theme.id"
              color="neutral"
              variant="outline"
              size="sm"
              class="transition-all duration-300"
              @click="activateTheme(theme.id)"
              :loading="isActivating === theme.id"
              :disabled="!!isActivating && isActivating !== theme.id"
            >
              {{ isActivating === theme.id ? 'Activating...' : 'Activate' }}
            </UButton>
            <UButton
              v-else
              color="primary"
              variant="soft"
              class="bg-purple-500/10 text-purple-400 transition-all duration-500"
              size="sm"
              icon="ph:check-circle-fill"
              disabled
            >
              Currently Active
            </UButton>

            <UButton
              :to="`/admin/themes/${theme.id}`"
              color="neutral"
              variant="ghost"
              icon="ph:sliders-horizontal"
              size="sm"
              class="text-gray-400 hover:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast, useCookie, definePageMeta } from '#imports'

definePageMeta({ title: 'Themes' })

const { settings, getSetting, fetchSettings } = useSettings()

const toast = useToast()

const isActivating = ref('')

const { data: themes } = await useFetch<any[]>('/api/admin/theme')

const activateTheme = async (themeId: string) => {
  isActivating.value = themeId
  try {
    // Artificial delay to make the UX smoother and feel like a real processing task
    await new Promise((resolve) => setTimeout(resolve, 800))

    const updatedSettings = {
      ...settings.value,
      active_theme: themeId,
    }

    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: updatedSettings,
    })

    // Force refresh settings to update the UI reactively
    await fetchSettings(true)

    toast.add({
      title: 'Theme Activated',
      description: `Successfully switched to ${
        themes.value?.find((t: any) => t.id === themeId)?.name || themeId
      }. Please rebuild the system to apply changes globally.`,
      color: 'success',
    })

    // Scroll to the top active theme configuration section to shift user focus
    setTimeout(() => {
      const el = document.getElementById('active-theme-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add a temporary highlight effect
        el.classList.add(
          'ring-2',
          'ring-purple-500',
          'ring-offset-2',
          'ring-offset-[#050505]'
        )
        setTimeout(() => {
          el.classList.remove(
            'ring-2',
            'ring-purple-500',
            'ring-offset-2',
            'ring-offset-[#050505]'
          )
        }, 1500)
      }
    }, 100)
  } catch (e: any) {
    toast.add({
      title: 'Activation Failed',
      description: e.data?.message || e.message || 'Failed to activate theme',
      color: 'error',
    })
  } finally {
    isActivating.value = ''
  }
}
</script>