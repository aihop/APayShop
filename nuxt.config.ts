const isPostgresDialect = process.env.DB_DIALECT === 'postgresql'
const isCloudflarePages = !!process.env.CF_PAGES
const isBuildCommand = process.argv.some(arg => arg.includes('build'))

if (isPostgresDialect && !isCloudflarePages && isBuildCommand) {
  delete process.env.DATABASE_URL
  delete process.env.POSTGRES_URL
  delete process.env.POSTGRESQL_URL
}

import fs from 'fs'
import path from 'path'

export default defineNuxtConfig({
  hooks: {
    'nitro:config'(nitroConfig) {
      const themesDir = path.resolve(__dirname, 'app/themes')
      if (fs.existsSync(themesDir)) {
        const themes = fs.readdirSync(themesDir)
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
  content: {
    // Note: Do not use content.dir to point to template directories, as it breaks Nuxt i18n
    // dynamic route resolution for nested templates.
    locales: ['zh'],
    defaultLocale: 'en'
  },
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
      { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '简体中文' }
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
      'admin/failures': false,
      'admin/themes/index': false,
      'admin/themes/[theme]': false,
      'admin/themes/builder': false,
      'admin/extensions/[...slug]': false,
      'admin/cards': false,
      'admin/subscriptions': false,
      'admin/posts': false,
      'admin/logs': false,
      'admin/api-keys': false,
      'admin/stats': false,
    }
  },
  hub: {
    db: {
      dialect: (process.env.DB_DIALECT as any) || 'sqlite',
      driver: isCloudflarePages ? 'd1' : (isPostgresDialect ? 'postgres-js' : 'libsql'),
      connection: isCloudflarePages
        ? undefined
        : isPostgresDialect
          ? {}
          : {
              url: process.env.LIBSQL_URL || 'file:.data/db/sqlite.db'
            },
      // 关键：如果在VPS上，打包时禁用自动迁移，防止它去尝试连接不存在的云端 DB
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
  ui: {
    icons: ['heroicons', 'ph']
  },
  tailwindcss: {
    config: {
      plugins: [require('@tailwindcss/typography')],
    }
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
    }
  },
  runtimeConfig: {
    // 这里的键名会自动映射到环境变量 NUXT_DATABASE_URL
    databaseUrl: '', 
  }
})
