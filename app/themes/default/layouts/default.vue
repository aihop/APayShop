<template>
  <div class="min-h-screen bg-[#09090b] text-gray-100 font-sans">
    <header class="border-b border-gray-800/50 sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur">
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
            class="hidden md:flex items-center gap-4 text-sm text-gray-400 font-medium"
          >
            <RouteSearch />
            <NuxtLink
              to="https://apayshop.com/docs"
              target="_blank"
              class="hover:text-purple-400 transition-colors"
            >{{ $t('admin.nav.docs') }}</NuxtLink>
          </nav>
          <nav
            v-else
            class="hidden md:flex items-center gap-6 text-sm text-gray-400 font-medium"
          >
            <NuxtLink
              to="/"
              class="hover:text-purple-400 transition-colors"
            >Home</NuxtLink>
            <NuxtLink
              to="/products"
              class="hover:text-purple-400 transition-colors"
            >Products</NuxtLink>
            <NuxtLink
              to="/pricing"
              class="hover:text-purple-400 transition-colors"
            >Pricing</NuxtLink>
            <NuxtLink
              to="/about"
              class="hover:text-purple-400 transition-colors"
            >About Us</NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <template v-if="!isAdminRoute">
            <div class="hidden md:block">
              <NuxtLink
                to="/admin/login"
                class="text-sm text-gray-300 hover:text-purple-400 transition-colors"
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
              <div class="hidden md:flex">
                <ClientOnly>
                  <UDropdownMenu
                    :items="userMenuItems"
                    :ui="{ content: 'w-48' }"
                  >
                    <UButton
                      color="neutral"
                      variant="ghost"
                      class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold border border-purple-500/30 text-sm hover:bg-purple-500/30 transition-colors p-0 cursor-pointer"
                    >
                      A
                    </UButton>
                  </UDropdownMenu>
                </ClientOnly>
              </div>
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
        </div>
      </div>
    </header>
    <!-- Mobile Slideover Menu -->
    <USlideover
      v-model:open="isMobileMenuOpen"
      side="left"
    >
      <template #content>
        <div class="p-6 flex flex-col h-full bg-[#09090b]">
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
            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x-bold"
              @click="isMobileMenuOpen = false"
            />
          </div>

          <!-- Mobile Admin Nav -->
          <nav
            v-if="isAdminRoute"
            class="flex flex-col gap-4"
          >
            <div class="space-y-1">
              <h3 class="text-[11px] font-semibold text-gray-500 tracking-wider mb-3 px-3">{{ $t('admin.nav.store') }}</h3>
              <NuxtLink
                to="/admin"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
              <NuxtLink
                v-if="hasApiKeysProducts"
                to="/admin/api-keys"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:key"
                    class="w-5 h-5"
                  />
                  API Keys
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/failures"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:warning-circle"
                    class="w-5 h-5"
                  />
                  Failures
                </div>
              </NuxtLink>
            </div>
            <div
              v-if="extensionPages.length"
              class="space-y-1 mt-4"
            >
              <h3 class="text-[11px] font-semibold text-gray-500 tracking-wider mb-3 px-3">{{ themeSectionTitle }}</h3>
              <NuxtLink
                v-for="page in extensionPages"
                :key="page.key"
                :to="page.route"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="page.icon"
                    class="w-5 h-5 text-purple-400"
                  />
                  {{ page.title }}
                </div>
              </NuxtLink>
            </div>

            <div class="space-y-1 mt-4">
              <h3 class="text-[11px] font-semibold text-gray-500 tracking-wider mb-3 px-3">{{ $t('admin.nav.configs') }}</h3>
              <NuxtLink
                to="/admin/payments"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users-three"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.admins') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/themes"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                to="/admin/logs"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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
                to="/admin/settings"
                class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#121214]"
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

            <div class="mt-auto pt-8 border-t border-gray-800">
              <div class="mb-4 px-3 flex gap-2">
                <LanguageSwitcher
                  :current-locale="locale"
                  :locales="locales"
                  :show-text="true"
                  @switch="switchLocale"
                />
              </div>
              <UButton
                color="primary"
                class="w-full justify-center bg-purple-600 hover:bg-purple-500 text-white mb-4"
                to="/"
                target="_blank"
                @click="isMobileMenuOpen = false"
              >
                {{ $t('admin.header.viewStore') }}
              </UButton>
              <NuxtLink
                to="/admin/profile"
                class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-[#121214]"
                @click="isMobileMenuOpen = false"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:user"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.nav.profile') }}
                </div>
              </NuxtLink>
              <button
                @click="logout"
                class="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-[#121214]"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:sign-out"
                    class="w-5 h-5"
                  />
                  {{ $t('admin.header.logout') }}
                </div>
              </button>
            </div>
          </nav>

          <!-- Mobile Storefront Nav -->
          <nav
            v-else
            class="flex flex-col gap-4"
          >
            <NuxtLink
              to="/"
              class="px-4 py-3 rounded-xl text-lg font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
              @click="isMobileMenuOpen = false"
            >Home</NuxtLink>
            <NuxtLink
              to="/products"
              class="px-4 py-3 rounded-xl text-lg font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
              @click="isMobileMenuOpen = false"
            >Products</NuxtLink>
            <NuxtLink
              to="/pricing"
              class="px-4 py-3 rounded-xl text-lg font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
              @click="isMobileMenuOpen = false"
            >Pricing</NuxtLink>
            <NuxtLink
              to="/about"
              class="px-4 py-3 rounded-xl text-lg font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
              @click="isMobileMenuOpen = false"
            >About</NuxtLink>
            <NuxtLink
              to="/contact"
              class="px-4 py-3 rounded-xl text-lg font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
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
        class="w-56 flex-shrink-0 hidden md:block py-10 pr-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <div class="space-y-8">
          <div>
            <h3 class="text-[11px] font-semibold text-gray-500 tracking-wider mb-3 px-3">{{ $t('admin.nav.store') }}</h3>
            <nav class="space-y-1">
              <NuxtLink
                to="/admin"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                exact-active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                v-if="hasSubscriptionProducts"
                to="/admin/subscriptions"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:calendar-check"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.subscriptions') }}
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasKeyProducts"
                to="/admin/cards"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:barcode"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.cards') }}
                </div>
              </NuxtLink>
              <NuxtLink
                v-if="hasApiKeysProducts"
                to="/admin/api-keys"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:key"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.apiKeys') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/failures"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:warning-circle"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.failures') }}
                </div>
              </NuxtLink>
            </nav>
          </div>
          <div v-if="extensionPages.length">
            <h3 class="text-[11px] font-semibold text-gray-500 tracking-wider mb-3 px-3">{{ themeSectionTitle }}</h3>
            <nav class="space-y-1">
              <NuxtLink
                v-for="page in extensionPages"
                :key="page.key"
                :to="page.route"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="page.icon"
                    class="w-4 h-4 text-purple-400"
                  />
                  {{ page.title }}
                </div>
              </NuxtLink>
            </nav>
          </div>
          <div>
            <button
              type="button"
              class="w-full mb-3 px-3 flex items-center justify-between text-[11px] font-semibold text-gray-500 tracking-wider hover:text-gray-300 transition-colors"
              @click="isConfigsExpanded = !isConfigsExpanded"
            >
              <span>{{ $t('admin.nav.configs') }}</span>
              <UIcon
                name="ph:caret-down"
                class="w-4 h-4 transition-transform duration-200"
                :class="isConfigsExpanded ? 'rotate-180' : ''"
              />
            </button>
            <nav
              v-if="isConfigsExpanded"
              class="space-y-1"
            >
              <NuxtLink
                to="/admin/payments"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    name="ph:users-three"
                    class="w-4 h-4"
                  />
                  {{ $t('admin.nav.admins') }}
                </div>
              </NuxtLink>
              <NuxtLink
                to="/admin/logs"
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
                class="block px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-[#121214]"
                active-class="bg-[#121214] text-white"
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
      class="border-t border-gray-800/50 py-12 mt-20"
    >
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex flex-col md:flex-row items-center justify-between">
          <p class="text-sm text-gray-500 leading-6">
            &copy; {{ new Date().getFullYear() }} {{ getSetting('site_name') || 'Your Site' }}. All rights reserved.
            <span class="ml-1">Designed & Developed by <a
                href="https://apayshop.com/"
                target="_blank"
                class="text-gray-400 hover:text-purple-400 transition-colors"
              >APayShop</a></span>
          </p>
          <div class="flex items-center space-x-4 mt-4 md:mt-0">
            <a
              href="#"
              class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300"
              aria-label="Twitter"
            >
              <Icon
                name="ph:twitter-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300"
              aria-label="LinkedIn"
            >
              <Icon
                name="ph:linkedin-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300"
              aria-label="YouTube"
            >
              <Icon
                name="ph:youtube-logo-fill"
                class="w-4 h-4"
              />
            </a>
            <a
              href="#"
              class="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300"
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
const isMobileMenuOpen = ref(false)
const isConfigsExpanded = ref(false)
const { getSetting } = useSettings()
const { extensionPages, themeSectionTitle } = useAdminExtensions()
const normalizeAdminPath = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

const { locale, locales, t } = useI18n()

const switchLocale = async (newLocale: 'en' | 'zh') => {
  locale.value = newLocale

  if (typeof document !== 'undefined') {
    document.cookie = `i18n_redirected=${newLocale}; path=/; max-age=31536000`
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

const hasApiKeysProducts = ref(false)
const hasKeyProducts = ref(false)
const hasSubscriptionProducts = ref(false)

// Optional: you could check if there are dynamic_api products
// But to keep it simple, we'll just check if the apiKeys table has any entries
// or if we have products of type 'dynamic_api'
onMounted(async () => {
  if (isAdminRoute.value) {
    try {
      const res: any = await $fetch('/api/products/types')
      const types = res.data || []
      hasApiKeysProducts.value = types.includes('dynamic_api')
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
