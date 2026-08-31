import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { resolveAvailableThemes, resolveDevThemeEnv, resolveManifestFile, resolveSelectedThemes } from './scripts/theme-shared.mjs'
import { normalizePublicProtocol, parseDomainLocales } from './shared/domainLocales'

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
) as { version?: string }

const buildAppVersion = String(
  process.env.APAY_BUILD_VERSION
  || packageJson.version
  || '1.0.0'
).trim().replace(/^v(?=\d)/i, '')

// 开发环境支持多实例并行：通过 APAY_DATA_DIR 指定独立数据目录，避免 sqlite/缓存冲突
const dataDir = process.env.APAY_DATA_DIR || '.data'

const isCloudflarePagesTarget = (() => {
  const preset = String(process.env.NITRO_PRESET || '').trim().toLowerCase()
  return Boolean(process.env.CF_PAGES) || preset === 'cloudflare-pages'
})()

// Single source of truth shared with scripts/generate-theme-build.mjs, so the
// nitro handlers/public assets/global components registered here always match
// the themes bundled into the client (app/generated/theme-build.ts).
const resolveBuildThemes = () => {
  const themesDir = path.resolve(__dirname, 'app/themes')
  const manifestFile = resolveManifestFile(__dirname, process.env.APAY_THEME_MANIFEST || '')

  return resolveSelectedThemes({
    themesDir,
    manifestFile,
    explicitThemes: '',
    envThemes: resolveDevThemeEnv() || process.env.APAY_BUILD_THEMES || process.env.BUILD_THEMES || '',
  })
}

// APAY_DEV_THEME=<theme> npm run dev:一个变量同时收窄 dev 的构建主题(见上面
// envThemes 档)并强制前台主题(下方 devTheme,免去再设 NUXT_PUBLIC_DEV_THEME)。
// 逗号列表只收窄构建、不强制前台主题。resolveDevThemeEnv 已限定只在 npm run dev
// 生命周期返回非空,正式构建不受影响。
const DEV_THEME = resolveDevThemeEnv()

// 主题页面/组件可以按 manifest 过滤构建，但服务端 API 一旦对外暴露成固定
// 路径(`/api/<theme>/*`)，就不应随着可选主题裁剪而消失，否则现网站点在 core-only
// 构建下会直接出现 404。这里让 Nitro 始终注册全部主题 API handlers。
// 例外:APAY_DEV_THEME 收窄的 dev 实例只服务选中主题的页面,其余主题的 handlers
// (光 qingpu 就 148 个)只会拖慢 nitro 扫描/重建,这种场景下按选中主题注册即可。
const resolveNitroApiThemes = () => {
  const themesDir = path.resolve(__dirname, 'app/themes')
  if (resolveDevThemeEnv()) {
    return resolveBuildThemes()
  }
  return resolveAvailableThemes(themesDir)
}

// 站点语言在构建时确定(i18n 的 locales/defaultLocale 是构建期配置,运行时改不了)。
// 后台「本地化」里的 supported_locales/default_locale 管的是内容多语言(商品翻译、
// SEO),不影响前台 URL 前缀——要让单语言站不带 /zh 这类后缀,得在这里收窄语言表:
//   APAY_LOCALES=zh ./build.sh <repo> <theme>        → 只有 zh,且无前缀
//   APAY_LOCALES=zh,en APAY_DEFAULT_LOCALE=zh    → zh 无前缀,en 走 /en
// 不设则启用 Shoply 线上既有四语言与俄语，默认 en。
const I18N_ALL_LOCALES = [
  { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
  { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '简体中文' },
  { code: 'zh-HK', iso: 'zh-HK', file: 'zh-HK.json', name: '香港繁體' },
  { code: 'ru', iso: 'ru-RU', file: 'ru.json', name: 'Русский' },
]

const resolveI18n = () => {
  const wanted = String(process.env.APAY_LOCALES || '')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)

  // 过滤后为空(未配置或全是无效码)时回落全量,避免把站点构建成没有任何语言
  const locales = wanted.length
    ? I18N_ALL_LOCALES.filter(locale => wanted.includes(locale.code))
    : I18N_ALL_LOCALES
  const usable = locales.length ? locales : I18N_ALL_LOCALES

  // 默认语言必须在启用列表内,否则 i18n 会给它加前缀(单语言站就又出现 /zh 了)
  const preferred = String(process.env.APAY_DEFAULT_LOCALE || '').trim()
  const defaultLocale = usable.some(locale => locale.code === preferred)
    ? preferred
    : (usable.some(locale => locale.code === 'en') && !wanted.length ? 'en' : usable[0]!.code)

  return { locales: usable, defaultLocale }
}

const { locales: I18N_BASE_LOCALES, defaultLocale: I18N_DEFAULT_LOCALE } = resolveI18n()
const DOMAIN_LOCALES = parseDomainLocales(
  process.env.APAY_DOMAIN_LOCALES,
  I18N_BASE_LOCALES.map(locale => locale.code),
)
const DOMAIN_HOSTS = Object.keys(DOMAIN_LOCALES)
const PUBLIC_PROTOCOL = normalizePublicProtocol(process.env.APAY_PUBLIC_PROTOCOL)
const I18N_LOCALES = DOMAIN_HOSTS.length
  ? I18N_BASE_LOCALES.map(locale => ({
      ...locale,
      language: locale.iso,
      domains: DOMAIN_HOSTS,
      defaultForDomains: DOMAIN_HOSTS.filter(host => DOMAIN_LOCALES[host] === locale.code),
    }))
  : I18N_BASE_LOCALES.map(locale => ({ ...locale, language: locale.iso }))
const LIBSQL_NATIVE_PACKAGE_PATTERN = /^(darwin|linux|win32)-/
const resolveInstalledLibsqlNativePackages = () => {
  const libsqlPackagesDir = path.resolve(__dirname, 'node_modules/@libsql')
  if (!fs.existsSync(libsqlPackagesDir)) return []

  return fs.readdirSync(libsqlPackagesDir)
    .filter(name => LIBSQL_NATIVE_PACKAGE_PATTERN.test(name))
    .map(name => {
      const packageDir = path.join(libsqlPackagesDir, name)
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
      ) as { main?: string }
      return path.join(packageDir, packageJson.main || 'index.node')
    })
}
// dev 忽略清单。注意:这个数组同时喂给 `ignore: DEV_WATCH_IGNORE`(nuxt 的**扫描**
// 忽略,影响组件/自动导入/页面扫描)和 vite watch。所以**绝不能**放 `node_modules`
// 或根 `.nuxt`——那会让 nuxt 连 @nuxt/ui 从 node_modules 注册的组件(UAvatar 等)一起
// 屏蔽掉,表现为「Failed to resolve component: UAvatar」。node_modules 本就被 nuxt/vite
// 默认排除监听,不必也不该在这里列。EMFILE(too many open files)靠 dev 脚本的
// `ulimit -n 65536` 兜底 + 下面排除 build/ 这个非默认忽略的大头(2.5 万文件)解决。
const DEV_WATCH_IGNORE = [
  'app/themes/**/.git',
  'app/themes/**/.git/**',
  'app/themes/**/.nuxt',
  'app/themes/**/.nuxt/**',
  'app/themes/**/node_modules',
  'app/themes/**/node_modules/**',
  'app/themes/**/.output',
  'app/themes/**/.output/**',
  'app/themes/**/dist',
  'app/themes/**/dist/**',
  '.dbg',
  '.claude',
  // ⚠️ 本数组按 **gitignore 语义** 匹配:不带前导斜杠的 `build`/`dist` 会命中**任意层级**
  // 的同名目录,包括 `node_modules/@nuxt/ui/dist/**`——那会让 UApp/UAvatar 等整个
  // @nuxt/ui 组件库解析失败,渲染树直接塌掉(连 NuxtPage/NuxtLayout 都挂不上)。
  // 排除项目自己的产物目录时**必须加前导斜杠锚定根目录**;上面 `app/themes/**/…`
  // 那些带路径前缀的写法本身已锚定,不受影响。
  //
  // build/:build.sh 往这里 rsync 各站点完整 .output(含整份 node_modules),
  // 非默认忽略且文件量上万,不排除会拖垮 file watcher(EMFILE)。
  '/build',
  '/build/**',
  '/build/*/.output',
  '/build/*/.output/**',
  '/.git',
  '/.git/**',
]

export default defineNuxtConfig({
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  appConfig: {
    appVersion: buildAppVersion,
  },
  ignore: DEV_WATCH_IGNORE,
  routeRules: {
    '/themes/**/manifest.json': {
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' },
    },
    '/themes/**/assets/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
  // 主题私有 vendor 的客户端别名:纯函数(如 qingpu-engine 定价计算)可在浏览器组件复用;
  // 这里避免使用 `#` 前缀,否则会落入 Node package imports 语义,把主题私有约定抬成
  // 根包级别配置。nitro 侧同名别名见下方 nitro:config 钩子,两侧解析到同一目录。
  alias: (() => {
    const themesDir = path.resolve(__dirname, 'app/themes')
    const aliases: Record<string, string> = {
      // Cloudflare Workers 下 klona 默认入口会对无原型对象直接调用
      // x.hasOwnProperty(...)，在 app config 深拷贝时会崩。统一切到更稳的 full 版本。
      klona: path.resolve(__dirname, 'node_modules/klona/full/index.mjs'),
      '#geoip-local': path.resolve(__dirname, 'server/runtime/geoipLocal.node.ts'),
    }
    if (fs.existsSync(themesDir)) {
      resolveBuildThemes().forEach(theme => {
        const vendorDir = path.join(themesDir, theme, 'server', 'vendor')
        if (fs.existsSync(vendorDir)) {
          aliases[`@${theme}-vendor`] = vendorDir
        }
      })
    }
    return aliases
  })(),
  hooks: {
    'nitro:config'(nitroConfig) {
      const nitroAliases = nitroConfig.alias ||= {}
      nitroAliases.klona = path.resolve(__dirname, 'node_modules/klona/full/index.mjs')
      const nitroPreset = String(nitroConfig.preset || process.env.NITRO_PRESET || '').toLowerCase()
      nitroAliases['#geoip-local'] = path.resolve(
        __dirname,
        nitroPreset.includes('cloudflare')
          ? 'server/runtime/geoipLocal.edge.ts'
          : 'server/runtime/geoipLocal.node.ts'
      )

      const themesDir = path.resolve(__dirname, 'app/themes')
      if (fs.existsSync(themesDir)) {
        const apiThemes = resolveNitroApiThemes()
        const buildThemes = resolveBuildThemes()

        apiThemes.forEach(theme => {
          const apiDir = path.join(themesDir, theme, 'api')
          if (fs.existsSync(apiDir)) {
            const walkSync = (dir: string, filelist: string[] = []) => {
              fs.readdirSync(dir).forEach(file => {
                const dirFile = path.join(dir, file)
                const stat = fs.statSync(dirFile)
                if (stat.isDirectory()) {
                  filelist = walkSync(dirFile, filelist)
                } else {
                  filelist.push(dirFile)
                }
              })
              return filelist
            }
            
            const files = walkSync(apiDir)
            files.forEach(file => {
              if (file.endsWith('.ts')) {
                let route = file.replace(apiDir, '').replace(/\.ts$/, '')
                let method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | undefined
                route = route.split(path.sep).join('/')
                const methodMatch = route.match(/\.(get|post|put|patch|delete|head|options)$/)
                if (methodMatch) {
                  method = methodMatch[1] as typeof method
                  route = route.slice(0, -methodMatch[0].length)
                }
                if (route.endsWith('/index')) route = route.slice(0, -'/index'.length)
                route = route
                  .replace(/\/\[\.\.\.[^\]]+\]/g, '/**')
                  .replace(/\/\[([^\]]+)\]/g, '/:$1')
                
                nitroConfig.handlers = nitroConfig.handlers || []
                const isThemeAdminApi = route === '/admin' || route.startsWith('/admin/')
                const handlerRoutes = isThemeAdminApi
                  ? [`/api/admin/${theme}${route.slice('/admin'.length)}`]
                  : [`/api/${theme}${route}`]

                // Qingpu's existing admin clients use /api/qingpu/admin/** and
                // each handler enforces requireAdmin or a dedicated cron token.
                // Keep that legacy route while exposing the standardized alias.
                if (isThemeAdminApi && theme !== 'minimal') {
                  handlerRoutes.push(`/api/${theme}${route}`)
                }

                for (const handlerRoute of handlerRoutes) {
                  nitroConfig.handlers.push({
                    route: handlerRoute,
                    handler: file.replace(/\\/g, '/'),
                    method,
                  })
                }
              }
            })
          }

          // 主题私有 vendor(构建产物库,如 qingpu-engine):注册 @<theme>-vendor 别名,
          // 让 nitro 以绝对路径打包,避免相对引用被外部化后解析错位
          const vendorDir = path.join(themesDir, theme, 'server', 'vendor')
          if (fs.existsSync(vendorDir)) {
            nitroAliases[`@${theme}-vendor`] = vendorDir
          }

          // 自动发现并挂载主题服务端插件（如事件动作注册）
          const pluginsDir = path.join(themesDir, theme, 'server', 'plugins')
          if (fs.existsSync(pluginsDir)) {
            fs.readdirSync(pluginsDir).forEach(file => {
              if (file.endsWith('.ts') || file.endsWith('.js')) {
                nitroConfig.plugins = nitroConfig.plugins || []
                nitroConfig.plugins.push(path.join(pluginsDir, file).replace(/\\/g, '/'))
              }
            })
          }
        })

        buildThemes.forEach(theme => {
          const publicDir = path.join(themesDir, theme, 'public')
          if (fs.existsSync(publicDir)) {
            nitroConfig.publicAssets = nitroConfig.publicAssets || []
            const baseURL = `/themes/${theme}/`
            const exists = nitroConfig.publicAssets.some(
              (a: any) => a?.dir === publicDir || a?.baseURL === baseURL
            )
            if (!exists) {
              nitroConfig.publicAssets.push({ dir: publicDir, baseURL, maxAge: 300 })
            }
          }
        })
      }
    },
    'components:dirs'(dirs) {
      const themesDir = path.resolve(__dirname, 'app/themes')
      if (fs.existsSync(themesDir)) {
        const themes = resolveBuildThemes()
        themes.forEach(theme => {
          const componentsDir = path.join(themesDir, theme, 'components')
          if (fs.existsSync(componentsDir)) {
            dirs.push({
              path: componentsDir,
              global: true,
              pathPrefix: false,
              extensions: ['vue']
            })
          }
        })
      }
    },
    // 主题路由中间件:Nuxt 只扫描 srcDir/middleware,主题目录不在其中,
    // 所以主题的路由守卫必须在这里显式注册,否则文件存在也不会执行。
    // 命名加主题前缀避免重名;多主题会被同时打包,主题中间件需自行判定
    // active_theme 后再生效(与 core 的 user-auth.global.ts 同一套路)。
    'app:resolve'(app) {
      const themesDir = path.resolve(__dirname, 'app/themes')
      if (!fs.existsSync(themesDir)) return

      resolveBuildThemes().forEach(theme => {
        const middlewareDir = path.join(themesDir, theme, 'middleware')
        if (!fs.existsSync(middlewareDir)) return

        fs.readdirSync(middlewareDir)
          .filter(file => /\.(ts|js|mjs)$/.test(file))
          .sort()
          .forEach(file => {
            const filePath = path.join(middlewareDir, file)
            if (!fs.statSync(filePath).isFile()) return

            const baseName = file.replace(/\.(ts|js|mjs)$/, '')
            const isGlobal = baseName.endsWith('.global')
            const name = `${theme}-${isGlobal ? baseName.slice(0, -'.global'.length) : baseName}`
            if (app.middleware.some(entry => entry.path === filePath)) return

            app.middleware.push({
              name,
              path: filePath,
              global: isGlobal,
            })
          })
      })
    }
  },
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { 
    enabled: true
   },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxthub/core',
    '@nuxt/ui',
    '@vueuse/motion/nuxt',
    '@nuxtjs/i18n',
    'nuxt-auth-utils',
    '@nuxt/content'
  ],
  ui: {
    prose: true
  },
  // v3 的集合声明在根 content.config.ts;这里只管内容索引库落在哪。
  //
  // nativeSqlite 是必须的,不是优化项:v3 解析 sqlite 驱动时,默认分支会用 nypm
  // 自动安装 better-sqlite3(C++ 原生绑定),违反 AGENTS.md §3。打开它之后走 Node
  // 内置的 node:sqlite(v22.5+),零原生依赖。这条同时管住运行时库和构建期的
  // _localDatabase——后者是独立配置项,只钉 database 不够。
  //
  // 运行时库:Cloudflare Pages 复用 NuxtHub 的 D1 绑定(见 wrangler.toml);其余
  // 目标用本地 sqlite 文件。这里不用 libsql——@nuxt/content 的 nuxthub preset 会
  // 在非 dev 构建里把 file: 开头的 libsql 路径强制改写成 /tmp/sqlite.db。
  // content 只建 _content_* 表,与 drizzle 业务表同库不同表,互不影响。
  content: {
    experimental: { nativeSqlite: true },
    database: isCloudflarePagesTarget
      ? { type: 'd1' as const, bindingName: 'DB' }
      : { type: 'sqlite' as const, filename: `${dataDir}/content/contents.sqlite` },
  },
  i18n: {
    locales: I18N_LOCALES,
    defaultLocale: I18N_DEFAULT_LOCALE as 'en' | 'zh' | 'zh-HK' | 'id' | 'ru',
    multiDomainLocales: DOMAIN_HOSTS.length > 0,
    // 多域名先为全部语言生成带前缀路由，再由 i18n 按 Host 移除该域名默认语言
    // 前缀；单域名继续保持全局默认语言无前缀。
    strategy: DOMAIN_HOSTS.length ? 'prefix_and_default' : 'prefix_except_default',
    lazy: true,
    langDir: '../locales',
    customRoutes: 'config',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    pages: {
      'admin': false,
      'admin/index': false,
      'admin/login': false,
      'admin/orders': false,
      'admin/products': false,
      'admin/customers': false,
      'admin/settings/index': false,
      'admin/settings/themes': false,
      'admin/settings/manages': false,
      'admin/settings/authorization': false,
      'admin/settings/product-presets': false,
      'admin/payments': false,
      'admin/profile': false,
      'admin/settings/extensions': false,
      'admin/extensions/[...slug]': false,
      'admin/cards': false,
      'admin/subscriptions': false,
      'admin/posts': false,
      'admin/logs': false,
      'admin/stats': false,
      'admin/promo': false,
      'admin/topups': false,
    }
  },
  hub: {
    db: {
      dialect: "sqlite",
      driver: isCloudflarePagesTarget ? 'd1' : "libsql",
      connection: isCloudflarePagesTarget ? {} : { url: process.env.LIBSQL_URL || `file:${dataDir}/db/sqlite.db` },
      applyMigrationsDuringBuild: isCloudflarePagesTarget,
      applyMigrationsDuringDev: false, // 禁用开发环境的自动迁移，避免与正式环境冲突
    },
    blob: true,
  },
  fonts: {
    providers: {
      google: false,
      googleicons: false,
    }
  },
  icon: {
    collections: ['heroicons', 'ph']
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },
  nitro: {
    watchOptions: {
      ignoreInitial: true,
      ignored: DEV_WATCH_IGNORE,
    },
    prerender: {
      routes: [],
      crawlLinks: false,
      // 原来是 ignore: ['/'],字符串按前缀匹配,等于忽略全部路由。@nuxt/content v3
      // 靠预渲染 /__nuxt_content/<collection>/sql_dump.txt 把内容灌进运行时数据库,
      // 被这条一起挡掉的话文档页查不到任何数据。这里保留「业务页面一律不预渲染」
      // 的原意,只放行内容 dump 路由(nitro 的 ignore 支持谓词函数)。
      ignore: [(route: string) => !route.startsWith('/__nuxt_content/')]
    },
    preset: process.env.NITRO_PRESET || (isCloudflarePagesTarget ? 'cloudflare-pages' : 'node-server'),
    minify: isCloudflarePagesTarget,
    sourceMap: false,
    compressPublicAssets: true, // 开启 gzip/br 压缩
    // libsql 必须保持 external，让 Nitro 追踪并复制当前平台的原生可选包；
    // 内联后其动态 require(`@libsql/${target}`) 无法被追踪，独立产物会启动失败。
    externals: {
      inline: ['entities', 'parse5', ...(isCloudflarePagesTarget ? ['libsql'] : [])],
      traceInclude: isCloudflarePagesTarget ? [] : resolveInstalledLibsqlNativePackages(),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      reportCompressedSize: false, // 禁用压缩大小报告
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('prosemirror') || id.includes('tiptap')) {
              return 'editor-vendor'
            }
            if (id.includes('@vueuse/motion')) {
              return 'animation-vendor'
            }
          }
        }
      }
    },
    server: {
      allowedHosts: true,
      hmr: false,
      watch: {
        ignored: DEV_WATCH_IGNORE,
      }
    }
  },
  runtimeConfig: {
    // 这里的键名会自动映射到环境变量 NUXT_DATABASE_URL
    databaseUrl: '',
    public: {
      // 开发环境强制指定主题，方便同时运行多主题开发实例（NUXT_PUBLIC_DEV_THEME=ainode）
      // APAY_DEV_THEME 单主题时自动兜底,免设第二个变量;显式 NUXT_PUBLIC_DEV_THEME 优先
      devTheme: process.env.NUXT_PUBLIC_DEV_THEME
        || (DEV_THEME && !DEV_THEME.includes(',') ? DEV_THEME : ''),
      apayDomainLocales: DOMAIN_LOCALES,
      apayPublicProtocol: PUBLIC_PROTOCOL,
      apayLocales: I18N_BASE_LOCALES.map(locale => ({ code: locale.code, language: locale.iso })),
      apayDefaultLocale: I18N_DEFAULT_LOCALE,
      apayBuildThemes: resolveBuildThemes(),
    },
  },
  sourcemap: { server: false, client: false },
})
