#!/usr/bin/env node
/**
 * dev 启动前清掉构建残留的 theme-manifest。
 *
 * build.sh 收尾会把 manifest 写成 core-only(publishedOptionalThemes: []),
 * 而 nuxt.config 的主题 vendor 别名(@<theme>-vendor)按 manifest 注册——
 * 残留的空清单会让所有主题别名消失,dev 里 import '@qingpu-vendor/...' 直接
 * 解析失败。generate-theme-build.mjs 只重写 theme-build.ts、不碰 manifest,
 * 所以 predev 单靠它救不回来。
 *
 * 删掉 manifest 后 resolveSelectedThemes 走环境变量档:默认回落「全部可用主题」,
 * 设置 APAY_DEV_THEME=<theme> 时 dev 只构建该主题(开发提速,见 theme-shared.mjs)。
 */
import fs from 'fs'
import path from 'path'

const manifestFile = path.resolve(process.cwd(), 'app/generated/theme-manifest.json')
if (fs.existsSync(manifestFile)) {
  fs.rmSync(manifestFile)
  console.log('[dev] 已清除构建残留的 theme-manifest(dev 使用全部主题)')
}
