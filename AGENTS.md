# APayShop: 极简极客风全栈虚拟商品独立站

> **变更日志 (Changelog)**
> `2026-05-29`: 修正 Section 6 章节编号 (A→B→C→D→E→F→G)；补充测试策略与本节说明。
> `2026-05-30`: 新增 Section 9 Git 提交流程约束。
> `2026-05-30`: 补充后台日志/列表时间字段的跨环境归一化约定，见 Section 6.A。
> `2026-05-30`: 修正 SQLite `logs.created_at` 默认值与历史数据迁移方式，见 Section 6.A。
> `2026-06-26`: 将旧充值商品语义重构为 `topup`，用于外部账户余额充值而非本地 API Key 发放，见 Section 4。
> `2026-06-26`: 移除本地 API Key 资产模型与相关迁移定义，APayShop 不再维护本地 API Key 资产表，见 Section 3 与 Section 6.G。

## 1. 项目定位与核心架构

APayShop 是一个专为**虚拟商品（服务订阅、卡密、数字文件、API接口等）**设计的极客风全栈独立站。
最大特点是**“极致轻量、零外部依赖”**。完全基于 **Nuxt 4 + NuxtHub** 构建。支持在本地 SQLite 与 Cloudflare D1 之间无缝切换，实现免费且极速的全球边缘部署。

### 核心技术栈

- **框架**: Nuxt 4 (全栈 SSR/SPA 混合模式，业务代码在 `app/`，后端代码在 `server/`)
- **UI & 样式**: Tailwind CSS + Nuxt UI v4 (深色模式、发光效果、毛玻璃质感)
- **数据库 & ORM**: Drizzle ORM + `@nuxthub/db` (本地 SQLite / 生产 D1)
- **身份认证**: `@nuxt-auth-utils` (极简加密 Session，原生 Web Crypto API，**彻底弃用 bcryptjs**)
- **文档渲染**: `@nuxt/content` v2.13.4 (必须保持在根目录 `content/` 下)

### SaaS 矩阵中的商业定位

APayShop 是整个 SaaS 矩阵（APayShop 官网 + Shoply 基座 + QingPu 演示小程序）中的**唯一计费中心和引流门户**。它负责完成“按月/按年订阅”的售卖，以规避小程序端虚拟支付的合规风险。APayShop 只负责“收钱”和“通知”，绝对不参与具体的建站、小程序提审等繁重业务逻辑。

---

## 2. 独创架构与核心机制

### A. 多模版动态引擎 (Multi-Theme System)

- **机制**: 前端页面未写死，采用 Catch-all 路由 `app/pages/[...slug].vue` 拦截请求。
- **渲染**: 根据当前激活的主题，动态从 `app/themes/[theme_name]/` 引入 Vue 文件渲染。

### B. 动态支付 Webhook 引擎 (Serverless Callback)

- **机制**: 支付回调解析逻辑不写死在代码中，而是作为 JS 字符串存在 `payment_methods.callback` 数据库字段中。收到 Webhook 时，通过 Node.js Sandbox (`vm`) 动态执行验证，实现支付网关的热插拔。
- **沙盒能力边界**: 当前支付沙盒除 `fetch`、`hash/hmac` 外，还已暴露通用 `RSA-SHA256 签名/验签`、`AES-256-GCM 解密` 与随机串生成能力，足以支撑微信支付 v3 这类需要商户私钥签名和回调密文解密的网关脚本。

### E. 跨系统服务调度 (Webhook to Shoply)

- **机制**: 当用户在 APayShop 成功支付 SaaS 订阅套餐后，APayShop 不直接操作底层业务数据库。而是利用 `payment_methods.callback` 中的沙盒代码，向 Shoply 后端发起 Webhook 通知（需携带用户手机号/UnionID 等凭证），由 Shoply 接管后续的“转正、生成独立小程序”等业务流。

### C. 访客与买家双轨制 (Guest & User)

- 支持仅凭 Email 和 Cookie (`visitorId`) 匿名下单。
- 用户后续注册时，系统会自动在 `orders` 表中认领历史匿名订单，实现平滑渐进式注册。

### D. 后台扩展页机制 (Theme Admin Extensions)

- **机制**: 后台核心框架仍固定在 `app/pages/admin/` 与 `app/themes/default/layouts/default.vue`，但当前已支持**主题注册后台扩展页**。
- **注册方式**: 每个主题可在 `app/themes/[theme]/theme.admin.json` 中声明扩展页面清单。
- **组件位置**: 对应页面组件放在 `app/themes/[theme]/admin/pages/`。
- **渲染入口**: 系统通过 `app/pages/admin/extensions/[...slug].vue` 统一承载扩展页，路由命名空间固定为 `/admin/extensions/*`。
- **自动接入**: 当前激活主题的扩展页会自动注入后台侧栏菜单与 `RouteSearch` 搜索列表。
- **设计原则**: 主题只能扩展后台页面，不应整体接管 `/admin` 核心后台壳；登录、鉴权、通用布局、系统级后台页仍由主系统统一维护。

---

## 3. 数据库核心模型 (Drizzle Schema)

定义于 `server/db/schema.ts`：

1. **`admins`**: B端后台管理员。
2. **`users`**: C端买家。
3. **`products`**: 核心商品表。包含 `type`、`slug`、`metaData` (JSON 扩展字段)、`views` (浏览量) 等。
4. **`orders`**: 订单表。包含 `status` (none, processing, active, delivered, expired, failed, completed)。
5. **`cards`**: 虚拟资产表（卡密）。
6. **`payment_methods`**: 支付插件配置。
7. **`posts`**: 博客与系统文章。
8. **`logs`**: 系统操作与事件日志。

---

## 4. 产品类型与履约引擎 (Fulfillment)

统一由 `server/utils/fulfillment.ts` 处理：

- **`basic`**: 无特殊处理，直接发货。
- **`key`**: 自动从 `cards` 提取卡密发货。
- **`file`**: 提供固定资源链接下载。
- **`subscription`**: 订单转为 `active`，记录周期。
- **`service`**: 根据 `metaData.form_schema` 收集动态表单，转入 `processing` 等待人工处理。
- **`topup`**: 充值型商品。支付成功后通过统一事件/Webhook 向外部系统入账，适合 Credits / 余额充值场景。

---

## 5. 后台管理规范 (Admin Dashboard)

- **隔离性**: 路由 `/admin/**` 和接口 `/api/admin/**` 受 `server/middleware/auth.ts` 严格保护。
- **UI 风格**: 深色电竞风，紧凑直观。大量使用 `UTable`、`UPagination`、`UCard` 和 `UForm`。
- **动态更新**: 修改主题等配置后，通过调用 `/api/admin/system/rebuild` 触发后台 `child_process` 异步构建与重启，实现“切换即生效”。
- **扩展约定**: 新的主题后台页优先走 `/admin/extensions/*`，由 `theme.admin.json` + `app/themes/[theme]/admin/pages/` 注册，而不是直接把主题逻辑硬编码进 `app/pages/admin/`。

---

## 6. 开发规范与避坑指南 (CRITICAL FOR AI)

### A. 跨环境数据库兼容 (SQLite vs PG vs MySQL)

- **数据库导入**: 必须使用 `import { db } from '@nuxthub/db'`，绝对禁止相对路径引入。
- **JSON 字段插入差异 (致命坑点)**: Drizzle 在本地 SQLite 需要字符串，而在 Cloudflare D1 需要原生对象。插入/更新 `metaData` 等 JSON 字段时**必须**使用如下范式：
  ```typescript
  metaData: process.env.NUXT_HUB_DATABASE
    ? metaDataObj
    : JSON.stringify(metaDataObj);
  ```
- **时间函数方言差异 (致命坑点)**: 后台统计类接口（如 `dashboard.get.ts`）如果涉及 `created_at` 的日期聚合、按小时分组、今日统计，绝对不能混用不同数据库的方言。必须按方言分支（`isPostgres`, `isMysql` 等）分别处理：
  - **SQLite**: `strftime('%H', datetime(..., 'unixepoch', 'localtime'))`
  - **PostgreSQL**: `to_char(date_trunc('hour', ...), 'HH24')` 并且不能把 `Date` 对象直接塞进 Drizzle 原始 `sql\`` 条件里，优先转成 ISO 字符串再显式 `::timestamptz`。
  - **MySQL**: `DATE_FORMAT(..., '%H')`
- **后台时间字段返回格式归一化 (新增坑点)**: 后台列表接口如果直接返回 `createdAt`、`updatedAt` 等时间字段，不能把 SQLite 原始 `CURRENT_TIMESTAMP` 字符串直接透传给前端再 `new Date(...)`；应优先在服务端统一转换成 ISO 字符串，前端再做容错格式化，避免日志、安装记录这类列表在 SQLite 下“明明有时间但不显示”。
- **SQLite `logs.created_at` 默认值修正**: `logs.created_at` 在 SQLite 下必须使用 `default(sql\`(unixepoch())\`)`，不能继续使用 `CURRENT_TIMESTAMP`，否则数据库会把整数时间字段写成 text，导致 Drizzle 映射与后台列表展示异常。已有历史库需执行一次性修复脚本，将 `logs.created_at` 的 text 时间批量转成整数秒时间戳后再重建表。
- **Schema 维护**: 由于 Drizzle 的类型绑定特性，目前系统平行维护了 `schema.sqlite.ts`, `schema.pg.ts` 和 `schema.mysql.ts` 三套表结构。每次新增或修改表字段时，必须同时在这三个文件中进行更新。

### B. 文件上传与静态资源

- **兼容策略**: 图片上传需同时兼容本地 `uploads/` 目录和云端 `hubBlob()`。
- **静态代理**: 本地环境已在 `nuxt.config.ts` 的 `nitro.publicAssets` 中配置了 `fallthrough: true` 来直接代理 `uploads/`，防止构建膨胀。

### C. 前端 SSR 与 SEO 渲染 (致命坑点)

- **动态组件抓取**: 在多模板入口 `app/pages/[...slug].vue` 中，必须使用 `import.meta.glob(..., { eager: true })` 强制同步加载组件。如果使用异步加载，SSR 阶段将无法捕获到子页面的 `useSeoMeta`，导致网页源代码缺失 `<title>`。
- **后台扩展页也遵循同样思路**: 主题后台扩展组件通过 `import.meta.glob(..., { eager: true })` 从 `app/themes/**/admin/pages/**/*.vue` 同步扫描，避免构建后丢失动态映射。

### D. Nuxt UI v4 语法约定与最佳实践

- **优先使用原生 Props**: 当使用 Nuxt UI 组件时，如果组件本身提供了对应功能的 prop（例如 `<UTable sticky>`），**必须优先使用原生 prop**，绝对禁止自己写一堆复杂的 Tailwind CSS 类名（如 `[&>thead>tr>th]:sticky`）去模拟组件已有的功能。保持代码的极致简洁。
- **自定义组件命名规范**: 用户端和后台网页端封装的自定义组件，**绝对不要**使用 `Common` 作为前缀（例如避免使用 `CommonSiteLogo`、`CommonLanguageSwitcher`）。直接使用清晰的业务语义命名，例如 `SiteLogo`、`LanguageSwitcher`，通过目录结构（如 `app/components/common/`）来区分通用性，而不是通过组件名称前缀。
- **弹窗绑定**: 所有的弹窗必须使用 `v-model:open` 绑定状态，且包裹在 `<template #content>` 中：
  ```vue
  <UModal v-model:open="isOpen">
    <template #content> ... </template>
  </UModal>
  ```
- **分页与滚动标准 (`usePagination`)**: 后台列表和前台列表必须使用统一的 `usePagination` 组合式函数来管理分页状态和页面滚动。在 `<UPagination>` 中通过 `@update:page="() => onPageChange(refresh)"` 触发，这样可以确保每次切换分页后自动平滑滚动回表格/页面顶部。

  ```vue
  <!-- Template -->
  <UPagination
    v-model="page"
    :page-count="pageCount"
    :total="totalItems"
    @update:page="() => onPageChange(refresh)"
  />

  <!-- Script -->
  <script setup>
  const { page, pageSize: pageCount, onPageChange } = usePagination(15);
  const { data, refresh } = await useFetch("/api/...", {
    query: { page, pageSize: pageCount },
  });
  </script>
  ```
- **后台扩展入口接入规则**: 如果新增模板后台扩展页，除了 `theme.admin.json` 和主题组件本身，还要同步确认默认后台侧栏与 `app/components/RouteSearch.vue` 是否已通过统一注册逻辑自动接入；禁止再新增一套分散硬编码菜单。
- **主题后台扩展页国际化规则**: 主题后台扩展页的文案不要继续混塞在前台 `locales/en.ts`、`zh.ts` 中；优先放到 `app/themes/[theme]/locales/admin/en.ts` 与 `admin/zh.ts`，并由 `app/pages/admin/extensions/[...slug].vue` 统一 merge 到当前主题命名空间下，保持现有 `ainode.admin.*` 这类 key 兼容。
- **模板后台直连 Golang 管理接口模式**: 主题后台扩展页如果需要直接调用 `ainode` 的管理接口，优先复用 `useExternalApi({ proxy: true, baseURL: AI_GATEWAY_URL })` 并在 `onMounted` 中发起请求，模式参照 `app/themes/aihop/pages/user/dashboard.vue` 的 `fetchGatewayStats`。统一经由 `server/api/proxy/external.ts` 转发，由服务端注入 `Authorization`，且该代理现在同时允许 `session.user` 与 `session.admin` 场景；适合 `/admin/extensions/*` 页面直接对接 Go 后台管理 API，例如 `models.vue`、`channels.vue` 这类 CRUD 页面直接对接 `/api/admin/models`、`/api/admin/channels`。
- **官网微信登录收口规则**: APayShop 官网主题（如 `minimal`）的微信登录应优先走 Shoply `go-fast` 的统一认证入口 `/auth/connect`、`/auth/connect/signin`、`/auth/connect/callback`，由通用网关再触发 `plugins/app/Wechat` 应用；APayShop 侧只保留前端入口、同源代理和回调承接，不再直接承载微信登录核心业务。
- **官网 PC 扫码微信登录配置**: 如果官网需要支持 PC 端微信扫码登录，Shoply `plugins/app/Wechat` 应用除常规 `appId/appSecret` 外，还应额外配置开放平台网站应用的 `websiteAppId/websiteAppSecret`；微信内 H5 授权与官网 PC 扫码应分别使用各自凭证，不要混用。

### E. 依赖禁区

- **绝对禁止**引入任何包含 C++ 或 Node 原生绑定的库（如 `bcryptjs`, `better-sqlite3`, `sqlite3`）。这会导致 Cloudflare 边缘节点打包直接崩溃。

### F. 本地支付插件目录约定

- `payments/[code]/` 目录下的 `create.js / callback.js / info.html / config.json` 会被后台支付管理页与支付发起/回调主链自动读取；适合沉淀本地默认插件模板。
- `payments/wechat/` 当前按官网收费场景实现为 `PC 扫码(Native) + 手机 H5(MWEB)` 的微信支付 v3 插件：
  - `create.js` 会基于请求 `UA + IP` 在 `tradeType=auto` 时自动选择 `native` 或 `h5`。
  - `callback.js` 依赖 `platformPublicKey + apiV3Key` 验签并解密通知报文。
  - `config.json` 至少需要配置 `appid / mchid / serialNo / privateKey / apiV3Key / platformPublicKey`。

### G. 数据库边界与 Schema 纯洁性 (禁止跨界定义模型)

- **边界清晰**: `server/db/schema.ts` 和 `schema.pg.ts` 只能且必须只包含 APayShop 本项目直接使用的核心业务表。
- **绝对禁止**: 严禁为了绕过 Drizzle ORM 的同步/迁移警告（如提示要删除其他外部系统创建的表或序列，例如 Go 后端的 `models`、`channels` 等），而将这些无关的外部模型强行加入到本项目的 Schema 文件中。
- **解决方式**: 面对多服务共用同一数据库的场景，应通过 `drizzle.config.ts` 中的 `tablesFilter` 精准匹配本项目表，或在执行 push/migrate 时手动忽略外部库变更，始终维护本系统 Schema 的独立与纯洁。

### H. 测试策略

> **当前状态**: 本项目未引入单元测试/集成测试框架。所有变更依赖手动验证与开发者的判断。

- **无测试不等于无验证** — 修改代码后，必须执行 `npm run dev` 启动开发服务器，手动验证关键链路（商品列表、下单、支付回调）正常。
- **构建验证**: 修改后端逻辑后，运行 `npm run build` 确认无编译错误。
- **未来引入测试时**，优先使用 `vitest` + `@vue/test-utils`（前端）和 `unjs/pragmatic`（后端），测试文件放在各模块同级 `__tests__/` 目录下。

---

## 7. 国际化与文档规范

- **数据多语言**: 数据库字段通过 `metaData.translations` 存储多语言，前端用 `useLocalizedProduct()` 解析。
- **API 文档强制同步**: 新增或修改 API 接口时，**必须**同步更新 `content/docs/` (英文) 和 `content/zh/docs/` (中文) 下的 Markdown 文档。一个模块对应一个文档，必须包含请求参数、响应体示例。

---

## 9. Git 提交流程 (任务完成约束)

每个任务完成并验证后，必须按此顺序执行 git 流程：

```bash
git pull --rebase   # 1. 先拉取远程最新代码，避免冲突
git add -A          # 2. 暂存所有变更
git commit -m "..." # 3. 提交（描述性信息）
git push            # 4. 推送至远程
```

> 先拉后推，绝不可颠倒。此规则也在 `.codewhale/instructions.md` 中记录，为 AI 的跨会话持久约束。

---

## 8. AI 自我进化与协作协议 (Self-Audit)

本文件是项目的**唯一事实来源 (Single Source of Truth)**。

**AI 强制触发更新条件**：
当发生以下行为后，AI **必须主动**更新本 `AGENTS.md` 文件：

1. 增删改了数据库 Schema。
2. 新增了独立的功能模块（如 Logs, Posts, Cards 等）。
3. 解决了具有代表性的环境兼容性 Bug（并提炼至避坑指南中）。

**更新操作模板**（AI 触发更新时按此格式在 Changelog 追加一行）：

> `2026-XX-XX`: 简短描述变更内容，指向对应章节。

**自我审计提问 (每次输出前)**：

> “我刚才的代码变更是否引入了新的架构模式或表结构？如果是，我是否已经将其记录到了 `AGENTS.md` 的对应章节中？”
