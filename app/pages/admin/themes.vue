<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{{ $t('admin.themes.page.title') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.themes.page.subtitle') }}</p>
      </div>

    </div>

    <!-- Active Theme Settings Link -->
 
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div
        v-for="theme in themes || []"
        :key="theme.id"
        class="group bg-white dark:bg-[#121214] border border-gray-200 dark:border-gray-800/60 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-colors flex flex-col"
        :class="{ 'ring-2 ring-purple-500 border-transparent': getSetting('active_theme') === theme.id }"
      >
        <div class="aspect-video bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
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
            <UIcon name="ph:check-circle-fill" /> {{ $t('admin.themes.card.active') }}
          </div>
        </div>

        <div class="p-5 flex flex-col flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ theme.name }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 flex-1">{{ theme.description }}</p>

          <div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
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
              {{ isActivating === theme.id ? $t('admin.themes.card.activating') : $t('admin.themes.card.activate') }}
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
              {{ $t('admin.themes.card.currently_active') }}
            </UButton>

            <UButton
              :to="`/admin/themes/${theme.id}`"
              color="neutral"
              variant="ghost"
              icon="ph:sliders-horizontal"
              size="sm"
              class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast, definePageMeta, useI18n } from '#imports'

definePageMeta({ title: 'Themes' })

const { t } = useI18n()

const { settings, getSetting, fetchSettings } = useSettings()

const toast = useToast()

const isActivating = ref('')

const { data: themes } = await useFetch<any[]>('/api/admin/theme')

const activateTheme = async (theme: string) => {
  isActivating.value = theme
  try {
    // Artificial delay to make the UX smoother and feel like a real processing task
    await new Promise((resolve) => setTimeout(resolve, 800))

    const updatedSettings = {
      ...settings.value,
      active_theme: theme,
    }

    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: updatedSettings,
    })

    // Force refresh settings to update the UI reactively
    await fetchSettings(true)

    const themeName = themes.value?.find((t: any) => t.id === theme)?.name || theme

    toast.add({
      title: t('admin.themes.toast.activated'),
      description: t('admin.themes.toast.activated_desc', { name: themeName }),
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
      title: t('admin.themes.toast.failed'),
      description: e.data?.message || e.message || t('admin.themes.toast.failed_desc'),
      color: 'error',
    })
  } finally {
    isActivating.value = ''
  }
}
</script>
