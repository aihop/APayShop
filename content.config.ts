import { defineCollection, defineContentConfig } from '@nuxt/content'

// @nuxt/content v3 不再自动扫描 content/ 目录,也移除了 v2 的
// `content.locales` / `content.defaultLocale` 配置形态。多语言在 v3 里按集合拆分:
// 每种语言一个集合,再由页面按当前 locale 选择集合查询。
//
// 路径口径与 v2 保持一致:content/docs/** 与 content/zh/docs/** 对外都呈现为
// /docs/**,靠 source.prefix 把 zh 目录前缀归一掉,所以中英文档共用同一套路由。
// 文件名前的序号(1. 2. …)只作排序,不进入 path,与 v2 行为相同。
export default defineContentConfig({
  collections: {
    docs_en: defineCollection({
      type: 'page',
      source: {
        include: 'docs/**/*.md',
        prefix: '/docs',
      },
    }),
    docs_zh: defineCollection({
      type: 'page',
      source: {
        include: 'zh/docs/**/*.md',
        prefix: '/docs',
      },
    }),
  },
})
