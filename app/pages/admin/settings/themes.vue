<template>
  <!-- 设置族成员页:套 settings 同款外壳与共享左栏导航,自身保留独立路由 -->
  <div class="mx-auto pb-12">
    <div class="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <UIcon
            name="ph:sparkle-duotone"
            class="w-8 h-8 text-purple-500"
          />
          {{ $t('admin.themes.page.title') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ $t('admin.themes.page.subtitle') }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <AdminSettingsNav
        active="themes"
        @select="goToSettingsTab"
      />

      <div class="lg:col-span-9">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="theme in themes"
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
              :disabled="(!!isActivating && isActivating !== theme.id) || !hasAdminPerm('settings:edit')"
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
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast, definePageMeta, useI18n, navigateTo } from '#imports'
import { publishedOptionalThemes } from '~/generated/theme-build'

definePageMeta({ title: 'Themes', layout: 'admin' })

const { t, te, tm } = useI18n()

const { settings, getSetting, fetchSettings } = useSettings()

const toast = useToast()
const { hasPerm: hasAdminPerm } = useAdminPermissions()

const isActivating = ref('')

// 共享导航上点了 settings 页内 tab → 跳回 settings 并落到对应 tab(?tab= 由 settings 解析)
const goToSettingsTab = (tabId: string) => {
  navigateTo({ path: '/admin/settings', query: { tab: tabId } })
}

const DEFAULT_THEME_META: Record<string, { name: string; description: string; image?: string }> = {
  hoxi: {
    name: '模型榜',
    description: '中文 AI 模型排行与选型站，极简蓝调风格，按能力评分与价格做横向对比并推荐省钱方案。',
  },
  ainode: {
    name: 'AI Gateway',
    description: '面向 AI 开发者的极简风格订阅与计费门户，带流量报表和团队管理入口。',
  },
  design: {
    name: 'Design Portfolio',
    description: '设计作品/素材类虚拟商品售卖模板，强调大图预览、案例展示和毛玻璃质感。',
  },
  minimal: {
    name: 'Minimal Storefront',
    description: '极客风极简独立站，适用于软件 License、API Key、数字文件等卡密型商品。',
  },
  nft: {
    name: 'NFT Drops',
    description: '数字藏品 / NFT 风格落地页模板，适合限时发售、稀有度分级与空投活动。',
  },
  official: {
    name: 'Official SaaS',
    description: '企业级 SaaS 订阅官网，适配组件库、服务订阅、年费授权等标准收费场景。',
  },
  panel: {
    name: 'Analytics Panel',
    description: '数据仪表盘导向的官网主题，强调统计、报表、安装与升级分布等后台化呈现。',
  },
  qingpu: {
    name: 'Qingpu AI 轻铺',
    description: 'AI 跨境铺货工作台官网主题，集中展示铺货能力、工具页、素材中心与创作中心。',
  },
}

const themeMetaMap = computed(() => {
  const keyFromI18n = (k: string) => `admin.themes.meta.${k}`
  return publishedOptionalThemes.reduce(
    (acc, key) => {
      const i18nKey = keyFromI18n(key)
      if (te(i18nKey)) {
        const meta = tm(i18nKey) as { name?: string; description?: string; image?: string }
        if (meta?.name || meta?.description || meta?.image) {
          acc[key] = {
            name: meta.name || DEFAULT_THEME_META[key]?.name || key,
            description: meta.description || DEFAULT_THEME_META[key]?.description || '',
            image: meta.image || DEFAULT_THEME_META[key]?.image,
          }
          return acc
        }
      }
      acc[key] = {
        name: DEFAULT_THEME_META[key]?.name || key,
        description: DEFAULT_THEME_META[key]?.description || '',
        image: DEFAULT_THEME_META[key]?.image,
      }
      return acc
    },
    {} as Record<string, { name: string; description: string; image?: string }>,
  )
})

const themes = computed(() =>
  publishedOptionalThemes.map((id) => {
    const meta = themeMetaMap.value[id] || DEFAULT_THEME_META[id] || { name: id, description: '' }
    return { id, name: meta.name, description: meta.description, image: meta.image }
  }),
)

const themeNameMap = computed(() =>
  publishedOptionalThemes.reduce(
    (acc, id) => {
      const meta = themeMetaMap.value[id] || DEFAULT_THEME_META[id]
      acc[id] = meta?.name || id
      return acc
    },
    {} as Record<string, string>,
  ),
)

const activateTheme = async (theme: string) => {
  isActivating.value = theme
  try {
    await new Promise((resolve) => setTimeout(resolve, 800))

    const updatedSettings = {
      ...settings.value,
      active_theme: theme,
    }

    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: updatedSettings,
    })

    await fetchSettings(true)

    const themeName = themeNameMap.value[theme] || theme

    toast.add({
      title: t('admin.themes.toast.activated'),
      description: t('admin.themes.toast.activated_desc', { name: themeName }),
      color: 'success',
    })

    setTimeout(() => {
      const el = document.getElementById('active-theme-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add(
          'ring-2',
          'ring-purple-500',
          'ring-offset-2',
          'ring-offset-[#050505]',
        )
        setTimeout(() => {
          el.classList.remove(
            'ring-2',
            'ring-purple-500',
            'ring-offset-2',
            'ring-offset-[#050505]',
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
