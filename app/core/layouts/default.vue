<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans dark:bg-[#09090b] dark:text-gray-100">
    <header class="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur dark:border-gray-800/50 dark:bg-[#09090b]/80">
      <div class="max-w-[1440px] w-full px-6 lg:px-12 mx-auto h-16 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <NuxtLink
            to="/"
            class="flex items-center gap-2 mr-6"
          >
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center p-1.5">
              <SiteLogo
                :logo-data="getSetting('site_logo')"
                :alt="getSetting('site_name')"
                icon-color="white"
              />
            </div>
            <span class="font-extrabold tracking-wide text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
              {{ getSetting('site_name') }}
            </span>
          </NuxtLink>

          <!-- Desktop Navigation -->
          <nav
            v-if="isAdminRoute"
            class="hidden md:flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400"
          >
            <RouteSearch />
            <NuxtLink
              to="https://apayshop.com/docs"
              target="_blank"
              class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
            >{{ $t('admin.nav.docs') }}</NuxtLink>
          </nav>
          <nav
            v-else
            class="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400"
          >
            <NuxtLink
              to="/"
              class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
            >Home</NuxtLink>
            <NuxtLink
              to="/products"
              class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
            >Products</NuxtLink>
            <NuxtLink
              to="/pricing"
              class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
            >Pricing</NuxtLink>
            <NuxtLink
              to="/about"
              class="transition-colors hover:text-purple-500 dark:hover:text-purple-400"
            >About Us</NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <template v-if="!isAdminRoute">
            <div class="hidden md:block">
              <NuxtLink
                to="/admin/login"
                class="text-sm text-gray-600 transition-colors hover:text-purple-500 dark:text-gray-300 dark:hover:text-purple-400"
              >
                <UButton
                  color="primary"
                  class="bg-purple-600 hover:bg-purple-500 text-white rounded-full px-6 font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  <template #leading>
                    <Icon name="ph:user-fill" />
                  </template>
                  Login
                </UButton>
              </NuxtLink>
            </div>
            <!-- Mobile Menu Toggle -->
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:list-bold"
              class="md:hidden"
              @click="isMobileMenuOpen = true"
            />
          </template>
          <template v-else>
            <div class="hidden md:flex items-center gap-3">
              <LanguageSwitcher
                :current-locale="locale"
                :locales="locales"
                :show-text="true"
                @switch="switchLocale"
              />

              <UButton
                color="primary"
                variant="outline"
                class="rounded-full font-medium px-6 py-1.5 hidden md:flex shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                to="/"
                target="_blank"
              >
                {{ $t('admin.header.viewStore') }}
              </UButton>
              <ClientOnly>
                <UButton
                  color="neutral"
                  variant="ghost"
                  :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
                  class="rounded-full"
                  :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                  @click="toggleColorMode"
                />
              </ClientOnly>
              <div class="hidden md:flex">
                <ClientOnly>
                  <UDropdownMenu
                    :items="userMenuItems"
                    :ui="{ content: 'w-48' }"
                  >
                    <UButton
                      color="neutral"
                      variant="ghost"
                      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 p-0 text-sm font-bold text-purple-600 transition-colors hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30"
                    >
                      A
                    </UButton>
                  </UDropdownMenu>
                </ClientOnly>
              </div>
            </div>
            <ClientOnly>
              <UButton
                color="neutral"
                variant="ghost"
                :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
                class="md:hidden"
                :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                @click="toggleColorMode"
              />
            </ClientOnly>
            <!-- Mobile Menu Toggle -->
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:list-bold"
              class="md:hidden"
              @click="isMobileMenuOpen = true"
            />
          </template>
        </div>
      </div>
    </header>
    <!-- Mobile Slideover Menu -->
    <USlideover
      v-model:open="isMobileMenuOpen"
      side="left"
    >
      <template #content>
        <div class="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-[#09090b] dark:text-gray-100">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center p-1.5">
                <SiteLogo
                  :logo-data="getSetting('site_logo')"
                  :alt="getSetting('site_name')"
                  icon-color="white"
                />
              </div>
              <span class="font-extrabold tracking-wide text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                {{ getSetting('site_name') }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <ClientOnly>
                <UButton
                  v-if="isAdminRoute"
                  color="neutral"
                  variant="ghost"
                  :icon="isDark ? 'ph:sun-dim-bold' : 'ph:moon-bold'"
                  :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                  @click="toggleColorMode"
                />
              </ClientOnly>
              <UButton
                color="neutral"
                variant="ghost"
                icon="ph:x-bold"
                @click="isMobileMenuOpen = false"
              />
            </div>
          </div>

          <!-- Mobile Admin Nav -->
          <nav
            v-if="isAdminRoute"
            class="flex flex-col gap-4"
          >
            <div class="space-y-1">
              <h3 :class="adminSectionTitleClass">{{ $t('admin.nav.store') }}</h3>
              <NuxtLink
                to="/admin"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:squares-four"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.dashboard') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/stats"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:chart-bar"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.stats') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/orders"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:shopping-cart"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.orders') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/products"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:package"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.products') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/customers"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.customers') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/posts"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="lucide:newspaper"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.blogs') }}
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasKeyProducts"
                to="/admin/cards"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:barcode"
                    class="w-5 h-5"
                  />
                  Cards
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasSubscriptionProducts"
                to="/admin/subscriptions"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:calendar-check"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.subscriptions') }}
                </div>
              </NuxtLink>
            </div>

            <div class="space-y-1 mt-4">
              <h3
                v-if="extensionPages.length"
                :class="adminSectionTitleClass"
              >
                {{ themeSectionTitle }}
              </h3>
              <NuxtLink
                v-for="page in extensionPages"
                :key="page.key"
                :to="page.route"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="page.icon"
                    class="w-5 h-5"
                  />
                  {{ page.title }}
                </div>
              </NuxtLink>
            </div>

            <div class="space-y-1 mt-4">
              <h3 :class="adminSectionTitleClass">{{ $t('admin.nav.configs') }}</h3>
              <NuxtLink
                to="/admin/promo"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:megaphone-simple"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.promo') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/payments"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:credit-card"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.payments') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/users"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users-four"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.users') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/logs"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:log"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.logs') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/themes"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-sparkles"
                    class="w-5 h-5 text-purple-400"
                  />
                  {{ $t('admin.nav.themes') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/settings"
                :class="adminMobileNavItemClass"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:gear"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.settings') }}
                </div>
              </NuxtLink>
            </div>
          </nav>

          <!-- Mobile Frontend Nav -->
          <nav
            v-else
            class="flex flex-col flex-1"
          >
            <NuxtLink
              to="/"
              class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
              @click="isMobileMenuOpen = false"
            >Home</NuxtLink>
            <NuxtLink
              to="/products"
              class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
              @click="isMobileMenuOpen = false"
            >Products</NuxtLink>
            <NuxtLink
              to="/pricing"
              class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
              @click="isMobileMenuOpen = false"
            >Pricing</NuxtLink>
            <NuxtLink
              to="/about"
              class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
              @click="isMobileMenuOpen = false"
            >About</NuxtLink>
            <NuxtLink
              to="/contact"
              class="rounded-xl px-4 py-3 text-lg font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50 dark:hover:text-white"
              @click="isMobileMenuOpen = false"
            >Contact</NuxtLink>

            <div class="mt-auto pt-8">
              <NuxtLink
                to="/admin/login"
                @click="isMobileMenuOpen = false"
              >
                <UButton
                  color="primary"
                  class="w-full justify-center bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  <template #leading>
                    <Icon name="ph:user-fill" />
                  </template>
                  Login
                </UButton>
              </NuxtLink>
            </div>
          </nav>
        </div>
      </template>
    </USlideover>

    <div :class="isAdminRoute ? 'flex flex-1 max-w-[1440px] w-full px-6 lg:px-12 mx-auto' : ''">
      <!-- Admin Sidebar -->
      <aside
        v-if="isAdminRoute"
        class="admin-sidebar-scrollbar sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-10 pr-6 md:block"
      >
        <div class="space-y-8">
          <div>
            <h3 :class="adminSectionTitleClass">{{ $t('admin.nav.store') }}</h3>
            <nav class="space-y-1">
              <NuxtLink
                to="/admin"
                :class="adminDesktopNavItemClass"
                :exact-active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:squares-four"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.dashboard') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/stats"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:chart-bar"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.stats') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/orders"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:shopping-cart"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.orders') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/products"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:package"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.products') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/customers"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.customers') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/posts"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="lucide:newspaper"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.blogs') }}
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasKeyProducts"
                to="/admin/cards"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:barcode"
                    class="w-4 h-4"
                  />
                  Cards
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasSubscriptionProducts"
                to="/admin/subscriptions"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:calendar-check"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.subscriptions') }}
                </div>
              </NuxtLink>
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
            <h3 :class="adminSectionTitleClass">{{ $t('admin.nav.configs') }}</h3>
            <nav class="space-y-1">
              <NuxtLink
                to="/admin/promo"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:megaphone-simple"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.promo') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/payments"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:credit-card"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.payments') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/users"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users-four"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.users') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/logs"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:log"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.logs') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/themes"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-sparkles"
                    class="w-4 h-4 text-purple-400"
                  />
                  {{ $t('admin.nav.themes') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/settings"
                :class="adminDesktopNavItemClass"
                :active-class="adminNavActiveClass"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:gear"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.settings') }}
                </div>
              </NuxtLink>
            </nav>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main :class="isAdminRoute ? 'flex-1 min-w-0 py-10 pl-4 pr-4 md:pl-12 lg:pr-8' : ''">
        <div :class="isAdminRoute ? 'max-w-[1000px] mx-auto w-full' : ''">
          <slot />
        </div>
      </main>
    </div>

    <footer
      v-if="!isAdminRoute"
      class="mt-20 border-t border-gray-200/80 py-12 dark:border-gray-800/50"
    >
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex flex-col md:flex-row items-center justify-between">
          <p class="text-sm leading-6 text-gray-500 dark:text-gray-500">
            &copy; {{ new Date().getFullYear() }} {{ getSetting('site_name') || 'Your Site' }}. All rights reserved.
            <span class="ml-1">Designed & Developed by <a
                href="https://apayshop.com/"
                target="_blank"
                class="text-gray-600 transition-colors hover:text-purple-500 dark:text-gray-400 dark:hover:text-purple-400"
              >APayShop</a></span>
          </p>
          <div class="flex items-center space-x-4 mt-4 md:mt-0">
            <a
              href="#"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Twitter"
            >
              <Icon
                name="ph:twitter-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="LinkedIn"
            >
              <Icon
                name="ph:linkedin-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="YouTube"
            >
              <Icon
                name="ph:youtube-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="GitHub"
            >
              <Icon
                name="ph:github-logo-fill"
                class="w-4 h-4"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

const route = useRoute()
const colorMode = useColorMode()
const isMobileMenuOpen = ref(false)
const { getSetting } = useSettings()
const { extensionPages, themeSectionTitle } = useAdminExtensions()
const adminSectionTitleClass = 'mb-3 px-3 text-[11px] font-semibold tracking-wider text-gray-500 dark:text-gray-500'
const adminMobileNavItemClass = 'block rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#121214] dark:hover:text-white'
const adminDesktopNavItemClass = 'block rounded-md px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#121214] dark:hover:text-white'
const adminNavActiveClass = 'bg-gray-100 text-gray-900 dark:bg-[#121214] dark:text-white'
const isDark = computed(() => colorMode.value === 'dark')
const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

const { locale, locales, t } = useI18n()

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const switchLocale = async (newLocale: 'en' | 'zh') => {
  locale.value = newLocale

  if (typeof document !== 'undefined') {
    document.cookie = `i18n_redirected=${newLocale}; path=/; max-age=31536000`
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', newLocale)
  }

  // If it's an admin route, we don't use URL prefixes for i18n
  if (isAdminRoute.value) {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.reload()
      }, 50)
    }
    return
  }
}

const isAdminRoute = computed(() => {
  const path = normalizeAdminPath(route.path)
  return path.startsWith('/admin') && path !== '/admin/login'
})

const hasKeyProducts = ref(false)
const hasSubscriptionProducts = ref(false)

onMounted(async () => {
  if (isAdminRoute.value) {
    try {
      const res: any = await $fetch('/api/products/types')
      const types = res.data || []
      hasKeyProducts.value = types.includes('key')
      hasSubscriptionProducts.value = types.includes('subscription')
    } catch (e) {
      // ignore
    }
  }
})

const logout = async () => {
  await $fetch('/api/admin/logout', {
    method: 'POST',
  })
  isMobileMenuOpen.value = false
  navigateTo('/admin/login')
}

const userMenuItems = computed(() => [
  [
    {
      label: t('admin.nav.profile'),
      icon: 'ph:user',
      onSelect: () => navigateTo('/admin/profile'),
    },
  ],
  [
    {
      label: t('admin.header.logout'),
      icon: 'ph:sign-out',
      onSelect: logout,
    },
  ],
])
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
