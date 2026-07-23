import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { resolveManifestFile, resolveSelectedThemes } from './scripts/theme-shared.mjs'

// Single source of truth shared with scripts/generate-theme-build.mjs, so the
// nitro handlers/public assets/global components registered here always match
// the themes bundled into the client (app/generated/theme-build.ts).
const resolveBuildThemes = () => {
  const themesDir = path.resolve(__dirname, 'app/themes')
  const manifestFile = resolveManifestFile(__dirname, process.env.APAYSHOP_THEME_MANIFEST || '')

  return resolveSelectedThemes({
    themesDir,
    manifestFile,
    envThemes: process.env.APAYSHOP_BUILD_THEMES || process.env.BUILD_THEMES || '',
  })
}

export default defineNuxtConfig({
  // 主题私有 vendor 的客户端别名:纯函数(如 qingpu-engine 定价计算)可在浏览器组件复用;
  // nitro 侧同名别名见下方 nitro:config 钩子,两侧解析到同一目录
  alias: (() => {
    const themesDir = path.resolve(__dirname, 'app/themes')
    const aliases: Record<string, string> = {}
    if (fs.existsSync(themesDir)) {
      resolveBuildThemes().forEach(theme => {
        const vendorDir = path.join(themesDir, theme, 'server', 'vendor')
        if (fs.existsSync(vendorDir)) {
          aliases[`#${theme}-vendor`] = vendorDir
        }
      })
    }
    return aliases
  })(),
  hooks: {
    'nitro:config'(nitroConfig) {
      const themesDir = path.resolve(__dirname, 'app/themes')
      if (fs.existsSync(themesDir)) {
        const themes = resolveBuildThemes()
        themes.forEach(theme => {
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
                route = route.split(path.sep).join('/')
                if (route.endsWith('/index')) route = route.replace('/index', '')
                
                nitroConfig.handlers = nitroConfig.handlers || []
                nitroConfig.handlers.push({
                  route: `/api/${theme}${route}`,
                  handler: file.replace(/\\/g, '/')
                })
              }
            })
          }

          const publicDir = path.join(themesDir, theme, 'public')
          if (fs.existsSync(publicDir)) {
            nitroConfig.publicAssets = nitroConfig.publicAssets || []
            const baseURL = `/themes/${theme}/`
            const exists = nitroConfig.publicAssets.some(
              (a: any) => a?.dir === publicDir || a?.baseURL === baseURL
            )
            if (!exists) {
              nitroConfig.publicAssets.push({ dir: publicDir, baseURL })
            }
          }

          // 主题私有 vendor(构建产物库,如 qingpu-engine):注册 #<theme>-vendor 别名,
          // 让 nitro 以绝对路径打包,避免相对引用被外部化后解析错位
          const vendorDir = path.join(themesDir, theme, 'server', 'vendor')
          if (fs.existsSync(vendorDir)) {
            nitroConfig.alias = nitroConfig.alias || {}
            nitroConfig.alias[`#${theme}-vendor`] = vendorDir
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
  content: {
    locales: ['zh'],
    defaultLocale: 'en'
  },
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
      { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '简体中文' },
      { code: 'ru', iso: 'ru-RU', file: 'ru.json', name: 'Русский' }
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
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
      'admin/settings': false,
      'admin/users': false,
      'admin/payments': false,
      'admin/profile': false,
      'admin/themes/index': false,
      'admin/themes/[theme]': false,
      'admin/themes/builder': false,
      'admin/extensions/[...slug]': false,
      'admin/cards': false,
      'admin/subscriptions': false,
      'admin/posts': false,
      'admin/logs': false,
      'admin/stats': false,
      'admin/promo': false,
    }
  },
  hub: {
    db: {
      dialect: "sqlite",
      driver: process.env.CF_PAGES ? 'd1' : "libsql",
      connection: process.env.CF_PAGES ? {} : { url: process.env.LIBSQL_URL || 'file:.data/db/sqlite.db' },
      applyMigrationsDuringBuild: !!process.env.CF_PAGES,
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
    prerender: {
      routes: [],
      crawlLinks: false,
      ignore: ['/']
    },
    preset: process.env.NITRO_PRESET || (!!process.env.CF_PAGES ? 'cloudflare-pages' : 'node-server'),
    minify: true,
    compressPublicAssets: true, // 开启 gzip/br 压缩
    // 强制将这些容易丢失的包内联到产物中
    externals: {
      inline: ['entities', 'parse5','libsql']
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
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
      // hmr: {
      //   host: 'iqingpu.cn', 
      //   protocol: 'wss', 
      //   clientPort: 443 
      // }
      hmr: false
    }
  },
  runtimeConfig: {
    // 这里的键名会自动映射到环境变量 NUXT_DATABASE_URL
    databaseUrl: '', 
  }
})
