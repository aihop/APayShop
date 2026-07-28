<template>
  <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black selection:bg-white selection:text-black">
    <!-- Abstract Background -->
    <div class="absolute inset-0 pointer-events-none">
      <div
        class="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity grayscale"
        :style="backgroundStyle"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
    </div>

    <div class="w-full max-w-md relative z-10">

      <!-- 语言选择:登录前先选,选完这一页立即切,登录后的整个后台也跟着走 -->
      <div
        v-if="switchableLocales.length > 1"
        class="mb-4 flex justify-end"
      >
        <div
          class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-2xl"
          role="group"
          :aria-label="$t('admin.login.language')"
        >
          <UIcon
            name="ph:translate-duotone"
            class="w-4 h-4 ml-2 mr-0.5 text-gray-500"
          />
          <button
            v-for="loc in switchableLocales"
            :key="loc.code"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="loc.code === locale
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-white/10'"
            :aria-pressed="loc.code === locale"
            @click="switchLocale(loc.code)"
          >
            {{ loc.name || loc.code }}
          </button>
        </div>
      </div>

      <!-- Login Card -->
      <div class="bg-black/40 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl relative overflow-hidden group">
        <!-- Interactive gradient highlight on hover -->
        <div class="absolute -inset-24 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-2xl"></div>

        <div class="mb-10 text-center relative z-10">
          <h1 class="text-3xl font-medium tracking-tight text-white mb-2">{{ welcomeText }}</h1>
          <p class="text-gray-400 text-sm">{{ $t('admin.login.subtitle') }}</p>
        </div>

        <div
          v-if="route.query.setup === 'success'"
          class="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm flex items-center gap-3 relative z-10"
        >
          <UIcon
            name="ph:check-circle-fill"
            class="w-5 h-5"
          />
          {{ $t('admin.login.setupSuccess') }}
        </div>

        <form
          @submit.prevent="handleLogin"
          class="space-y-6 relative z-10"
        >
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-gray-300 block">{{ $t('admin.login.username') }}</label>
            <div class="relative">
              <input
                v-model="form.username"
                type="text"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                :placeholder="$t('admin.login.usernamePlaceholder')"
                required
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between items-center">
              <label class="text-sm font-medium text-gray-300 block">{{ $t('admin.login.password') }}</label>
            </div>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
              <!-- tabindex=-1:Tab 应该从密码框直接到登录按钮,不该在这个开关上停一下 -->
              <button
                type="button"
                tabindex="-1"
                class="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-white transition-colors focus:outline-none"
                :aria-label="showPassword ? $t('admin.login.hidePassword') : $t('admin.login.showPassword')"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <UIcon
                  :name="showPassword ? 'ph:eye-slash' : 'ph:eye'"
                  class="w-5 h-5"
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="w-full bg-white text-black font-medium py-3.5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading"
          >
            <UIcon
              v-if="isLoading"
              name="ph:spinner-gap-bold"
              class="w-5 h-5 animate-spin"
            />
            <span v-else>{{ $t('admin.login.submit') }}</span>
            <UIcon
              v-if="!isLoading"
              name="ph:arrow-right-bold"
              class="w-4 h-4"
            />
          </button>
        </form>

        <div
          v-if="errorMsg"
          class="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-center gap-2 relative z-10"
        >
          <UIcon
            name="ph:warning-circle-fill"
            class="w-5 h-5 shrink-0"
          />
          {{ errorMsg }}
        </div>
      </div>

      <!-- Footer text -->
      <div class="text-center mt-12 text-gray-600 text-xs font-medium tracking-wide">
        {{ $t('admin.login.footer') }} &copy; {{ new Date().getFullYear() }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { firstAllowedAdminRoute, useAdminSession } from '~/composables/useAdminPermissions'

const { settings, fetchSettings, getSetting } = useSettings()

// Resolved HERE, in the synchronous setup context — never inside handleLogin().
// Past the first `await` the component instance is gone, and useI18n() (which
// useAdminPermissions layers on for labelFor()) throws "Must be called at the
// top of a `setup` function". That error carries no `.data`, so it surfaced as
// a bogus "Invalid credentials" on an otherwise successful login while the
// redirect silently never ran. useAdminSession is the i18n-free half, which is
// all the login page needs.
const { admin, loadAdmin } = useAdminSession()
const { extensionPermissionDefs } = useAdminExtensions()
// 同理:useI18n() 也只能在这里取,handleLogin/switchLocale 里 await 之后就没实例了。
const { t, locale, locales, setLocale } = useI18n()

definePageMeta({
  layout: false, // Use no layout to take full screen control
})

const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
})
const isLoading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)

// Computed properties for customization
const welcomeText = computed(() => {
  return t('admin.login.title')
})

// 站点语言是构建期配置(nuxt.config 的 I18N_LOCALES),单语言站这里就只有一项,
// 模板据此整个隐藏切换器
const switchableLocales = computed(() =>
  (unref(locales) || []).map((loc: any) => (typeof loc === 'string' ? { code: loc, name: loc } : loc)),
)

const switchLocale = async (code: string) => {
  if (code === locale.value) return
  // setLocale 负责懒加载该语言的消息包 + 写 i18n_redirected cookie(SSR 下次靠它)。
  // admin 路由在 nuxt.config 的 i18n.pages 里被置为 false,没有语言前缀可跳,
  // 所以这里只是就地换语言,不会导航、不会丢 ?redirect= 参数,也不用整页刷新。
  await setLocale(code as any)
  // localStorage 是本仓自己的持久化(locale-persist 插件下次启动读它),
  // nuxt-i18n 不管这层,必须手动写——不写的话下次进后台又回到浏览器语言。
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', code)
  }
}

const backgroundStyle = computed(() => {
  return {
    backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
  }
})

const handleLogin = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: form,
      // 服务端的报错文案走 getRequestLocale(),它只看 accept-language。不带这个头
      // 就是浏览器语言说了算:页面明明切成中文,「管理员不存在」却回英文。
      headers: { 'accept-language': locale.value },
    })
  } catch (e: any) {
    // Only a genuine credential rejection reaches here now.
    errorMsg.value = e.data?.message || e.data?.statusMessage || t('admin.login.invalidCredentials')
    isLoading.value = false
    return
  }

  // Credentials were accepted. Nothing below may block the redirect — working
  // out the *best* landing page is a nice-to-have, being stranded on the login
  // form after a successful login is not. '/admin/profile' is the safe floor:
  // isRouteAllowedForAdmin() permits it for every admin regardless of grants.
  let redirectTarget = '/admin/profile'
  try {
    if (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')) {
      redirectTarget = route.query.redirect
    } else {
      // Force-refresh the shared admin state so it reflects the account that
      // JUST logged in, not whatever this browser tab had cached (e.g. a
      // previous admin who logged out in this same tab, or this account's own
      // permissions from before they were last changed).
      await loadAdmin(true)
      await fetchSettings()
      // Don't assume '/admin' (dashboard) is reachable — an admin without
      // the 'dashboard' permission needs to land on their first allowed page.
      redirectTarget = firstAllowedAdminRoute(admin.value, extensionPermissionDefs.value) || '/admin/profile'
    }
  } catch (e) {
    console.error('[admin-login] could not resolve the post-login landing page:', e)
  } finally {
    isLoading.value = false
  }

  router.push(redirectTarget)
}
</script>
