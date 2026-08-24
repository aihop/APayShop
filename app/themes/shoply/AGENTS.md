# Shoply 主题维护入口

本目录是 APay 的 Shoply 官网主题。它以旧 Shoply `bluex` 官网为品牌与内容参考，但运行时是 Nuxt 4 / Vue 3 主题，不依赖旧 Jet、Alpine、`theme_diy` 或 `/res/bluex` 资源路径。

## 开工边界

- 遵循 APay 根 `AGENTS.md`、`.ai/README.md` 与任务契约流程；写任务经确认并取得 claims 租约后再修改。
- 本主题拥有官网页面、布局、主题组件、主题清单、主题语言包与精选品牌资产。
- APay 拥有主题扫描、登录会话、管理员壳、支付、订单、SaaS 控制面与构建发布；不得在主题内复制或绕过。
- 不自动提交、推送、发布或切换 `active_theme`，不覆盖其他主题与主仓并行改动。

## 长期约定

- `en`、`zh`、`zh-HK`、`id`、`ru` 共享 Vue 页面结构，文案分别进入主题 `locales/` 的对应语言文件。
- 登录、注册、咨询与开放平台入口读取 `theme.json` 配置；不要把外部账户协议写入主题运行逻辑。
- 只迁移页面实际使用的旧站资产，优先用可维护的 SVG、CSS 与语义组件重构，不复制旧模板全量资源。
- 新增页面必须具备 SSR SEO、键盘可访问性，并检查 1440px 桌面与 390px 移动端无横向溢出。
- Tailwind 类名保持静态可扫描；通用区块组件使用业务语义命名，不使用 `Common` 前缀。

## 验证

- 静态合同：`node app/themes/shoply/scripts/check-theme.mjs`
- Apps/Theme 市场合同：`node --experimental-strip-types app/themes/shoply/scripts/check-marketplace.mjs`
- 类型检查：`APAY_BUILD_THEMES=shoply ./node_modules/.bin/nuxt typecheck`
- 正式构建：`APAY_BUILD_THEMES=shoply NODE_OPTIONS=--max-old-space-size=12288 npm run build`
