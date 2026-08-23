
import { addServerHandler, createResolver, defineNuxtModule, extendPages } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'saas-control-plane',
    configKey: 'saasControlPlane',
  },
  setup(_options, nuxt) {
    if (process.env.APAY_SAAS_CONTROL_PLANE_ENABLED === 'false') return

    const resolver = createResolver(import.meta.url)
    nuxt.options.runtimeConfig.saasControlPlaneCredentialKey =
      process.env.APAY_SAAS_CREDENTIAL_KEY || ''

    const appConfig = nuxt.options.appConfig as Record<string, unknown>
    const extensions = Array.isArray(appConfig.adminExtensions)
      ? appConfig.adminExtensions as Array<Record<string, unknown>>
      : []
    extensions.push({
      key: 'saas-control-plane',
      name: 'SaaS 管理',
      pages: [{
        key: 'dashboard',
        title: 'SaaS 管理',
        description: '管理外部 SaaS 连接、租户、套餐和订阅。',
        route: '/admin/saas',
        icon: 'ph:cloud-check',
        order: 20,
        permissionCode: 'ext:saas-control-plane:dashboard',
      }],
    })
    appConfig.adminExtensions = extensions

    extendPages((pages) => {
      pages.push({
        name: 'admin-saas-control-plane',
        path: '/admin/saas',
        file: resolver.resolve('./runtime/pages/admin.vue'),
      })
    })

    addServerHandler({
      route: '/api/saas-control-plane/admin/**',
      handler: resolver.resolve('./runtime/server/api'),
    })
  },
})
