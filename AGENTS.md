# APay: 极简极客风全栈虚拟商品独立站

> **变更日志 (Changelog)**
> `2026-07-29`: Qingpu 网页铺货 SKU 表新增单条 SKU 与复制能力；手工 SKU 落 `listingWorkspace.manualOverrides.manualVariants`，共享引擎统一合并展示/发布，复制保留价格、库存、包装和平台规格覆盖但使用独立空图片槽，见 Section 6.L。
> `2026-07-28`: 修正主题后台 API 注册命名空间：`minimal/api/admin/**` 统一注册到受全局管理员中间件保护的 `/api/admin/minimal/**`，不再意外暴露为 `/api/minimal/admin/**`；Qingpu 既有自鉴权地址保留兼容并新增标准安全别名，见 Section 6.D。
> `2026-07-28`: 将 `minimal` 收口为 APay 唯一支付中转层：所有 Qingpu 商品、订阅、试用与钱包充值订单统一按 relay topup 记录实际支付金额/币种、来源金额/币种、汇率及最终充值口径；新增 `orders.source + external_order_id` 唯一幂等键，中转订单不执行 APay 本地商品履约，付款后只通过专用 notify 或旧事件兜底中的一个通道通知 Qingpu，见 Section 2.E、Section 3 与 Section 6.F。
> `2026-07-28`: 新增语言绑定普通商品结算币种与汇率：全局 `currency` 作为基础/兜底币种，`locale_currency_bindings` 按语言覆盖；订单保存实际支付金额/币种，订阅、履约、外部入账与推广结佣统一使用锁定的基础币种金额；支付方式按订单币种过滤并在发起时二次校验，见 Section 6.F。
> `2026-07-28`: Qingpu 网页铺货新增渠道佣金匹配器工厂；Ozon 在选择平台类目后自动匹配并持久化佣金子类快照，已绑定时默认复用且不重复提示，匹配失败或用户主动纠正时才手动选择，见 Section 6.L。
> `2026-07-28`: Qingpu 网页铺货 SKU 编辑与扩展端统一为 revision-safe 即时修改：本地先应用、HTTP 串行提交、服务端基于最新聚合重放 mutation，冲突时以 `currentRevision` 重试一次；SKU 删除统一写入 `manualOverrides.excludedSkuIds`，不删除 canonical 货源变体，见 Section 6.L。
> `2026-07-25`: 加固 Admin Setup 链路安全：`/api/admin/setup` 改为 `onConflictDoNothing` + `unique constraint violation` 兜底的原子写入，消除竞态条件下的重复管理员风险；新增用户名格式白名单正则（3-32 位 `[a-zA-Z0-9_.-]`）与密码强度校验（≥10 位 + 大小写/数字至少两类 + 常见弱口令黑名单）；新增 `/api/admin/setup/check` 只读接口与对应中间件白名单；新增 `server/utils/rateLimit.ts` 提供进程内 IP 滑动窗口限流并接入 setup/check 两个公开端点；前端 `admin/setup.vue` 在 `onMounted` 中预先检查 initialized，已初始化时重定向至登录页，并新增密码强度进度条、规则清单、可见性切换与提交前校验。
> `2026-07-25`: 新增 0 元订单直通过账机制 + 每用户购买次数上限。`/api/orders/checkout` 当 `totalAmount <= 0` 时直接 `payStatus=PAID` 并调用 `fulfillOrder` 履约，返回 `isFreeOrder=true`；前端 `useCheckout` 据此跳过 PaymentWorkspace 弹窗直接 dispatch `order-success` 并跳转 `/callback/{orderId}`。同时通过 `products.metaData.perUserLimit` 支持自定义每用户购买上限；若该字段未配置且商品为 0 元，则默认限制为 1 次（防薅），显式写入 `0` 视为不限。后台商品编辑页新增对应输入框，见 Section 4。
> `2026-05-29`: 修正 Section 6 章节编号 (A→B→C→D→E→F→G)；补充测试策略与本节说明。
> `2026-05-30`: 新增 Section 9 Git 提交流程约束。
> `2026-05-30`: 补充后台日志/列表时间字段的跨环境归一化约定，见 Section 6.A。
> `2026-05-30`: 修正 SQLite `logs.created_at` 默认值与历史数据迁移方式，见 Section 6.A。
> `2026-06-26`: 将旧充值商品语义重构为 `topup`，用于外部账户余额充值而非本地 API Key 发放，见 Section 4。
> `2026-06-26`: 移除本地 API Key 资产模型与相关迁移定义，APay 不再维护本地 API Key 资产表，见 Section 3 与 Section 6.G。
> `2026-06-27`: 新增时间与时区规范（Section 6.I）。数据库存 UTC 时间戳 → 后端 API 输出 UTC ISO → 前端按 settings.timezone 渲染。Dashboard 与 Stats 聚合查询改为读取配置时区计算今日边界与按小时分组，不再依赖服务器本地时间。新增 `server/utils/timezone.ts` 提供跨方言时区工具函数。
> `2026-06-27`: 新增 ainode Go 后端 JSON 序列化规范（Section 6.J）。sqlc 必须配置 `emit_json_tags` + `json_tags_case_style: camel`，所有 API 统一输出小驼峰字段名。
> `2026-06-28`: 新增数据自动清理机制。后台统计页支持手动清理 `visitor_events` 表原始事件数据（默认保留 90 天），`visitor_profiles` 访客画像永久保留，见 Section 6.K。
> `2026-07-06`: 新增 Qingpu 主题私有 PostgreSQL 租户授权 Key 模块约定，主题专属表与直连 PG 逻辑不得并入全局 `server/db/schema.*`，见 Section 6.L。
> `2026-07-19`: 新增 Qingpu 主题用户级通用设置桶约定，铺货工作台偏好统一收口到 `qingpu_settings.config` JSON，而非继续拆散列表或污染全局 `settings`，见 Section 6.L。
> `2026-07-20`: 新增 Qingpu 铺货资源表软删统一约定，`products/workspaces/channel_drafts/image_assets` 一律使用 `deleted_at` 表达删除态；图片可恢复场景允许同时保留 `meta.softDeleted` 作为前端显示辅助，见 Section 6.L。
> `2026-07-23`: 新增 Qingpu 资产媒体主类型约定，`qingpu_assets` 使用 `media_type(image|video)` 区分图片与视频；“我的创作”资产中心与预览统一基于该字段分流，见 Section 6.L。
> `2026-07-23`: 新增 Qingpu 主题私有轻量状态表约定，`qingpu_kv` 用于 maintenance / lazy-cron 等少量全局幂等状态，不占用核心 `settings`，见 Section 6.L。
> `2026-07-23`: 新增 Qingpu 通用 AI 工具任务约定，主题工具页统一复用 `qingpu_tasks`（新增 `tool_image_generate`）与 `qingpu_assets`，不再为 text-to-image 等工具单独拆任务账本，见 Section 6.L。
> `2026-07-23`: 新增 Qingpu 1688 直抓原始协议统一约定，铺货服务端直抓统一保存 ainode crawl payload（`provider='ainode-crawl-1688'`），不得再把 ainode 返回重包成 OneBound 风格字段，见 Section 6.L。
> `2026-07-23`: 新增本地支付宝插件模板，`payments/alipay/` 按官网收费场景实现为 `PC 网页(page) + 手机 H5(wap)` 的支付宝 RSA2 插件，见 Section 6.F。
> `2026-07-22`: 新增 Promo 推广体系最小闭环建模，核心表包括 `promo_members / promo_invite_relations / promo_agent_relations / promo_agent_tiers / promo_order_attributions / promo_commissions`，用于承载会员邀请与总代理/子代理两级折扣体系，见 Section 3 与 Section 6.G。
> `2026-07-22`: 新增 Promo 总代理招募待审核闭环，`promo_agent_relations.status` 现承载 `pending / active / disabled` 三态；通过总代理 `agent` 链接注册的用户先进入待审核列表，经总代理确认后再转正式子代理，见 Section 6.G。
> `2026-07-22`: 修正 Promo tracking 捕获时机；前台首次访问带 `invite/promo/agent` 的页面即写入 `promo_tracking` Cookie，注册接口同时执行 `read + capture` 双保险，见 Section 6.G。
> `2026-07-22`: 修正 Promo tracking 合并逻辑；API 请求若无 query，不得让空的 `capturePromoTracking()` 结果覆盖 Cookie 中已有来源码，统一通过非空优先 merge，见 Section 6.G。

## 1. 项目定位与核心架构

APay 是一个专为**虚拟商品（服务订阅、卡密、数字文件、API接口等）**设计的极客风全栈独立站。
最大特点是**“极致轻量、零外部依赖”**。完全基于 **Nuxt 4 + NuxtHub** 构建。支持在本地 SQLite 与 Cloudflare D1 之间无缝切换，实现免费且极速的全球边缘部署。

### 核心技术栈

- **框架**: Nuxt 4 (全栈 SSR/SPA 混合模式，业务代码在 `app/`，后端代码在 `server/`)
- **UI & 样式**: Tailwind CSS + Nuxt UI v4 (深色模式、发光效果、毛玻璃质感)
- **数据库 & ORM**: Drizzle ORM + `@nuxthub/db` (本地 SQLite / 生产 D1)
- **身份认证**: `@nuxt-auth-utils` (极简加密 Session，原生 Web Crypto API，**彻底弃用 bcryptjs**)
- **文档渲染**: `@nuxt/content` v2.13.4 (必须保持在根目录 `content/` 下)

### SaaS 矩阵中的商业定位

APay 是整个 SaaS 矩阵（APay官网 + Shoply 基座 + QingPu 演示小程序）中的**唯一计费中心和引流门户**。它负责完成“按月/按年订阅”的售卖，以规避小程序端虚拟支付的合规风险。APay 只负责“收钱”和“通知”，绝对不参与具体的建站、小程序提审等繁重业务逻辑。

---

## 2. 独创架构与核心机制

### A. 多模版动态引擎 (Multi-Theme System)

- **机制**: 前端页面未写死，采用 Catch-all 路由 `app/pages/[...slug].vue` 拦截请求。
- **渲染**: 根据当前激活的主题，动态从 `app/themes/[theme_name]/` 引入 Vue 文件渲染。

### B. 动态支付 Webhook 引擎 (Serverless Callback)

- **机制**: 支付回调解析逻辑不写死在代码中，而是作为 JS 字符串存在 `payment_methods.callback` 数据库字段中。收到 Webhook 时，通过 Node.js Sandbox (`vm`) 动态执行验证，实现支付网关的热插拔。
- **沙盒能力边界**: 当前支付沙盒除 `fetch`、`hash/hmac` 外，还已暴露通用 `RSA-SHA256 签名/验签`、`AES-256-GCM 解密` 与随机串生成能力，足以支撑微信支付 v3 这类需要商户私钥签名和回调密文解密的网关脚本。

### E. 跨系统服务调度 (Webhook to Shoply)

- **机制**: 当用户在 APay 成功支付 SaaS 订阅套餐后，APay 不直接操作底层业务数据库。而是利用 `payment_methods.callback` 中的沙盒代码，向 Shoply 后端发起 Webhook 通知（需携带用户手机号/UnionID 等凭证），由 Shoply 接管后续的“转正、生成独立小程序”等业务流。
- **Minimal 支付中转边界**: Qingpu 发起的商品、订阅、试用、固定充值和自定义钱包充值一律在 `minimal` 中表示为 `minimal_checkout` relay topup。APay 只负责实际收款、换算快照、结佣和可靠通知，不执行本地发卡/订阅/余额变更；Qingpu 按 `externalOrderId` 幂等完成最终业务履约。
- **单通道通知**: 中转订单配置 `notifyUrl` 时只发送签名 `minimal.checkout.paid`；未配置时才回退通用 `order.paid`。专用通知失败不得切换第二通道，避免接收成功但响应丢失时重复入账；失败状态与尝试次数写回订单，后台通过专用 retry-notify 接口按原 `externalOrderId` 补发。

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
4. **`orders`**: 订单表。包含 `status` (none, processing, active, delivered, expired, failed, completed)，`amount/currency` 保存实际支付口径；`source/externalOrderId` 标识外部来源并提供组合唯一幂等约束。
5. **`cards`**: 虚拟资产表（卡密）。
6. **`payment_methods`**: 支付插件配置。
7. **`posts`**: 博客与系统文章。
8. **`logs`**: 系统操作与事件日志。
9. **`promo_*`**: 推广与代理体系表。承载会员邀请关系、代理层级、折扣档位、订单归因快照与收益流水。

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
- **主题后台 API 命名空间**: `app/themes/[theme]/api/admin/**` 的标准路由是 `/api/admin/[theme]/**`，必须进入全局管理员鉴权；禁止把没有自身 `requireAdmin`/专用令牌校验的后台接口暴露为 `/api/[theme]/admin/**`。自定义 Nitro 扫描器必须把文件段 `[id]` 转成 `:id`、`[...slug]` 转成 `**`。Qingpu 历史地址因接口内已有鉴权暂时保留兼容，新主题和 minimal 只使用标准地址。
- **主题后台扩展页国际化规则**: 主题后台扩展页的文案不要继续混塞在前台 `locales/en.ts`、`zh.ts` 中；优先放到 `app/themes/[theme]/locales/admin/en.ts` 与 `admin/zh.ts`，并由 `app/pages/admin/extensions/[...slug].vue` 统一 merge 到当前主题命名空间下，保持现有 `ainode.admin.*` 这类 key 兼容。
- **模板后台直连 Golang 管理接口模式**: 主题后台扩展页如果需要直接调用 `ainode` 的管理接口，优先复用 `useExternalApi({ proxy: true})` 并在 `onMounted` 中发起请求，模式参照 `app/themes/aihop/pages/user/dashboard.vue` 的 `fetchGatewayStats`。统一经由 `server/api/proxy/external.ts` 转发，由服务端注入 `Authorization`，且该代理现在同时允许 `session.user` 与 `session.admin` 场景；适合 `/admin/extensions/*` 页面直接对接 Go 后台管理 API，例如 `models.vue`、`channels.vue` 这类 CRUD 页面直接对接 `/api/admin/models`、`/api/admin/channels`。
- **官网微信登录收口规则**: APay 官网主题（如 `minimal`）的微信登录应优先走 Shoply `go-fast` 的统一认证入口 `/auth/connect`、`/auth/connect/signin`、`/auth/connect/callback`，由通用网关再触发 `plugins/app/Wechat` 应用；APay 侧只保留前端入口、同源代理和回调承接，不再直接承载微信登录核心业务。
- **官网 PC 扫码微信登录配置**: 如果官网需要支持 PC 端微信扫码登录，Shoply `plugins/app/Wechat` 应用除常规 `appId/appSecret` 外，还应额外配置开放平台网站应用的 `websiteAppId/websiteAppSecret`；微信内 H5 授权与官网 PC 扫码应分别使用各自凭证，不要混用。

### E. 依赖禁区

- **绝对禁止**引入任何包含 C++ 或 Node 原生绑定的库（如 `bcryptjs`, `better-sqlite3`, `sqlite3`）。这会导致 Cloudflare 边缘节点打包直接崩溃。

### F. 本地支付插件目录约定

- **Minimal relay topup**: 所有 Qingpu 支付唤醒统一写入 `metaData.checkoutBridge`（`processingMode=relay_topup`），同时锁定实际支付、来源换算和 `rechargeAmount/rechargeCurrency/balanceType`。外部 bridge 使用隐藏载体商品，站内 Qingpu 商品保留原 `productId` 供限购与报表，但支付完成都必须走 `fulfillMinimalCheckoutRelay()`，禁止进入普通 `fulfillOrder()`。
- **中转幂等键**: `orders.source='minimal_checkout' + orders.externalOrderId` 必须唯一；外部创建接口以 Qingpu 业务单号作为 `externalOrderId`，并发重试复用已有订单。下游也必须以同一字段原子去重。
- **语言结算币种**: 全局 `settings.currency` 是普通商品价格的基础币种与无绑定时的兜底币种；`settings.locale_currency_bindings` 保存 JSON 语言映射，汇率方向固定为 `1 基础币种 = rate 目标币种`。解析顺序为完整 locale → 主语言 → 全局默认，同币种汇率强制为 `1`。
- **订单币种快照**: 普通商品下单必须把 locale、基础币种/金额、目标币种、汇率、转换后金额锁定到 `orders.metaData.currencySnapshot`，并将实付币种写入 `orders.currency`。支付展示与支付脚本必须读取订单快照，不得按最新 settings 重新换算历史订单。
- **支付与记账口径分离**: `orders.amount / orders.currency` 是支付网关实际收取的金额与币种；订阅金额、履约 integration transaction、外部 `subscription.apply`、推广佣金和代理销售等级必须通过 `resolveOrderCurrencyAmounts()` 读取 `currencySnapshot.baseAmount / baseCurrency` 记账。不得把不同支付币种的 `orders.amount` 直接相加或直接用于内部入账；无快照历史订单才回退原订单金额与币种。
- **支付方式币种守卫**: 支付插件可通过 `configJson.currency`（兼容 `sourceCurrency / priceCurrency`）声明结算币种；声明后只允许匹配相同 `orders.currency`，支付列表和发起接口都必须校验。未声明币种的历史插件按币种无关方式兼容。

- `payments/[code]/` 目录下的 `create.js / callback.js / info.html / config.json` 会被后台支付管理页与支付发起/回调主链自动读取；适合沉淀本地默认插件模板。
- `payments/wechat/` 当前按官网收费场景实现为 `PC 扫码(Native) + 手机 H5(MWEB)` 的微信支付 v3 插件：
  - `create.js` 会基于请求 `UA + IP` 在 `tradeType=auto` 时自动选择 `native` 或 `h5`。
  - `callback.js` 依赖 `platformPublicKey + apiV3Key` 验签并解密通知报文。
  - `config.json` 至少需要配置 `appid / mchid / serialNo / privateKey / apiV3Key / platformPublicKey`。
- `payments/alipay/` 当前按官网收费场景实现为 `PC 网页(page) + 手机 H5(wap)` 的支付宝插件：
  - `create.js` 会基于请求 `UA` 在 `tradeType=auto` 时自动选择 `page` 或 `wap`，并按 Alipay OpenAPI 规则生成带 RSA2 签名的收银台跳转链接。
  - `callback.js` 依赖 `alipayPublicKey` 验签异步通知表单，并将 `TRADE_SUCCESS / TRADE_FINISHED / TRADE_CLOSED` 映射为系统支付状态。
  - `config.json` 至少需要配置 `appid / privateKey / alipayPublicKey`，可选补充 `sellerId / gateway / timeoutExpress / timestampOffsetMinutes`。

### G. 数据库边界与 Schema 纯洁性 (禁止跨界定义模型)

- **边界清晰**: `server/db/schema.ts` 和 `schema.pg.ts` 只能且必须只包含 APay 本项目直接使用的核心业务表。
- **绝对禁止**: 严禁为了绕过 Drizzle ORM 的同步/迁移警告（如提示要删除其他外部系统创建的表或序列，例如 Go 后端的 `models`、`channels` 等），而将这些无关的外部模型强行加入到本项目的 Schema 文件中。
- **解决方式**: 面对多服务共用同一数据库的场景，应通过 `drizzle.config.ts` 中的 `tablesFilter` 精准匹配本项目表，或在执行 push/migrate 时手动忽略外部库变更，始终维护本系统 Schema 的独立与纯洁。
- **Promo 代理待审核状态约定**: `promo_agent_relations.status` 现统一表达三种状态：`pending`（通过总代理代理链接注册、待审核）、`active`（已确认加入正式团队）、`disabled`（已拒绝或已停用）。总代理用户中心的团队人数、团队报表、团队订单默认只统计 `active`；待加入列表单独读取 `pending`。
- **Promo tracking 捕获约定**: `invite / promo / agent` 来源码不能只在下单接口中捕获。前台用户首次访问任意带相关 query 的页面时，就应通过 server middleware 写入 `promo_tracking` Cookie；注册接口需再次执行 `read + capture` 作为兜底，避免用户直接落到注册页或中途跳页后丢失归因来源。
- **Promo tracking 合并约定**: 读取 Cookie 与读取当前请求 query 时，不能直接用对象展开让后者覆盖前者；因为注册/下单 API 往往没有携带页面 query。必须采用“非空值优先覆盖”的 merge 规则，避免空字符串把 Cookie 中已有的 `inviteCode / promoCode / agentCode` 冲掉。

### H. 测试策略

> **当前状态**: 本项目未引入单元测试/集成测试框架。所有变更依赖手动验证与开发者的判断。

- **无测试不等于无验证** — 修改代码后，必须执行 `npm run dev` 启动开发服务器，手动验证关键链路（商品列表、下单、支付回调）正常。
- **构建验证**: 修改后端逻辑后，运行 `npm run build` 确认无编译错误。
- **未来引入测试时**，优先使用 `vitest` + `@vue/test-utils`（前端）和 `unjs/pragmatic`（后端），测试文件放在各模块同级 `__tests__/` 目录下。

### I. 时间与时区规范 (UTC Storage + Frontend Display)

> **核心原则**: 数据库一律存储 UTC 绝对时间（Unix 时间戳），后端 API 一律输出 UTC ISO 字符串（`.toISOString()`），前端通过 `useFormatTime()` 按 `settings.timezone` 配置渲染为本地时间显示。

#### 存储层

- SQLite: `integer` + `{ mode: 'timestamp' }` + `default(sql\`(unixepoch())\`)`，即 Unix 秒时间戳（天然 UTC）。
- PostgreSQL: `TIMESTAMP WITH TIME ZONE`，Drizzle 的 `timestamp` 模式同理。
- **绝对禁止**在数据库层存储带时区的字符串或本地时间。

#### 后端 API 输出层

- 所有列表/详情接口返回时间字段时，**必须**统一转为 ISO 字符串（`.toISOString()` 即 UTC），不得直接透传 SQLite `CURRENT_TIMESTAMP` 字符串或数据库原始值。
- 典型范式（参照 `server/api/admin/logs/index.get.ts` 的 `normalizeCreatedAt`）：
  ```typescript
  // 将各种格式归一化为 UTC ISO 字符串
  new Date(value).toISOString()  // → "2026-06-27T08:30:00.000Z"
  ```

#### 后端聚合查询（Dashboard / Stats 等按天/按小时统计）

- **必须**读取 `settings.timezone` 配置来计算"今天"边界和按小时分组，**不得**使用服务器本地时间（`new Date().setHours(0,0,0,0)`）或数据库 `'localtime'` 修饰符。
- 使用 `server/utils/timezone.ts` 中提供的工具函数：
  - `getConfiguredTimezone()` — 读取配置时区
  - `getStartOfDayUtc(tz)` — 获取目标时区"今天 00:00"的 UTC 毫秒/秒/ISO
  - `getSqliteOffsetModifier(tz)` — SQLite 时区偏移修饰符（如 `'+480 minutes'`）
  - `getCurrentHour(tz)` — 目标时区当前小时
- 按方言分支处理：
  - **SQLite**: `strftime('%H', datetime(ts, 'unixepoch', <offset>))` 替代 `'localtime'`
  - **PostgreSQL**: `date_trunc('hour', ts AT TIME ZONE '<IANA>')` 替代裸 `date_trunc`
  - **MySQL**: `CONVERT_TZ(ts, '+00:00', '<offset>')` 包裹时间列

#### 前端渲染层

- **推荐**: 使用 `useFormatTime()` composable（`app/composables/useFormatTime.ts`），自动读取配置时区并通过 `Intl.DateTimeFormat` 渲染。
  ```typescript
  const { formatDateTime, formatDate } = useFormatTime()
  // {{ formatDateTime(row.createdAt) }}  → "2026/06/27 14:30:00"（按时区显示）
  ```
- **兜底**: 如果时区配置缺失或无效，回退为 `'Asia/Shanghai'` 或 `'UTC'`。

### J. ainode Go 后端 JSON 序列化规范 (sqlc json tag)

- **sqlc 配置要求**: `sqlc.yaml` 中 **必须** 开启以下两项，不得省略：
  ```yaml
  emit_json_tags: true
  json_tags_case_style: camel
  ```
- **命名约定**: 所有 API 输出的 JSON 字段统一使用小驼峰（camelCase，如 `baseUrl`、`apiKey`、`supportsAsync`），**绝对禁止** 裸输出 Go 结构体的 PascalCase 字段名。
- **sqlc 生成约束**: 每次修改 `schema.sql` 或 `query.sql` 后必须重新执行 `sqlc generate` 以同步 `models.go` 中的 json tag。手写 db 层 struct（如 `outbox_queries.go`）不得与 sqlc 自动生成的模型重复定义类型，应复用 `models.go` 中的类型或直接删除手写定义。
- **前端对接**: 前端调用 `ainode` API 时，TypeScript 类型与解构字段必须对应小驼峰命名，不得混用 PascalCase。

### L. 主题私有 PostgreSQL 模块边界 (Qingpu Tenant Keys)

- **适用场景**: 当主题（例如 `qingpu`）需要维护自身的租户授权 Key、外部业务表或实验性 PG 表时，优先采用“主题私有服务端模块”方案，而不是污染全局 `server/db/schema.*`。
- **目录约定**:
  - 接口入口放在 `app/themes/[theme]/api/**`
  - 主题私有 PG 客户端、查询封装、工具函数放在 `app/themes/[theme]/server/**`
  - 建表 SQL 放在 `app/themes/[theme]/database/*.sql`
- **禁止事项**: 严禁把仅供主题使用的外部表、租户表、授权表强行加入 `server/db/schema.ts`、`schema.pg.ts`、`schema.sqlite.ts`、`schema.mysql.ts`。
- **用户级主题配置建议**: 对于 Qingpu 铺货工作台这类“按登录用户保存偏好”的主题私有设置，优先使用 `qingpu_settings` 这类用户级 JSON 配置桶（`user_id + config jsonb`），再按 `listing.modelSettings` 等命名空间扩展，避免为每一类偏好继续拆新的细粒度配置表。
- **主题级轻量状态建议**: 对于 Qingpu 维护任务、lazy-cron 抢占、水位等“非用户维度、少量键值”的主题私有状态，优先使用 `qingpu_kv(key primary key, value jsonb)` 这类轻量 KV 表；不要继续挤占核心 `settings`，也不要为单个状态再拆专表。
- **资源表软删统一**: Qingpu 铺货私有资源表 `qingpu_listing_products`、`qingpu_listing_workspaces`、`qingpu_listing_channel_drafts`、`qingpu_assets` 删除语义统一收口到 `deleted_at`；查询默认过滤 `deleted_at is null`，恢复/重建/upsert 必须显式清回 `deleted_at = null`。若图片前端需要“显示已软删 / 恢复”体验，可额外保留 `meta.softDeleted` 作为 UI 辅助标记，但数据库权威删除态仍以 `deleted_at` 为准。
- **资产媒体类型约定**: `qingpu_assets` 必须显式保存 `media_type`（当前白名单 `image / video`），前后端都不要再依赖 `kind`、`mode` 或 URL 后缀去临时猜测素材类型；新写入链路需同时落 `media_type`，历史数据可按 `meta/url/kind/mode` 幂等回填。
- **通用工具任务约定**: Qingpu 主题下 text-to-image / image-to-image / text-to-video 这类非 listing 专属 AI 工具，统一复用 `qingpu_tasks` 作为异步任务账本；任务类型按能力命名（如 `tool_image_generate`），不要继续创建 `qingpu_listing_tasks` 或工具专属任务表。工具产物统一落 `qingpu_assets`，并通过 `meta.source / meta.toolLabel / meta.prompt` 与“我的创作”联通。
- **1688 直抓原始协议约定**: Qingpu 铺货服务端直抓 1688 商品时，统一以 ainode `/ai/crawl` 返回 payload 作为 `canonical.extra.raw.payload` 的权威原始档，`canonical.extra.raw.provider` 固定标记为 `ainode-crawl-1688`；不得再在业务层把 ainode 返回重包成 OneBound 风格 `props_list / prop_imgs / skus.sku` 兼容结构。规格值图、SKU 维度与 fallback 聚合应直接基于 ainode raw 的 `specs / skus / detail_images / raw.skuList` 派生（`raw.skuList` 是每 SKU 包装尺寸/毛重的权威来源——`skus[].packaging` 实测常年为空，归一逻辑按 `spec_combination` 关联回填，唯一产线归口在引擎 `normalizeAinodeCrawl1688Product`，业务层不得再手写这层解析，见 qingpu-ai@332a7d9c / vendor v0.7.21）。
- **SKU 即时编辑与跨端一致性**: 网页工作台必须与 `qingpu-ai/entrypoints/dash` 保持同一 mutation 语义：前端先更新本地行模型，再串行提交；POST 携带商品 `baseRevision`，服务端每次读取最新 aggregate 后重放单个 mutation，并在同一事务内校验 revision、写 workspace、推进 revision。`409` 只允许基于服务端 `currentRevision` 自动重试一次，旧 revision 响应不得回退新状态。SKU “删除”只写 `listingWorkspace.manualOverrides.excludedSkuIds`，保留 canonical 采集变体；至少保留一条的校验按未排除 SKU 计算。
- **手工 SKU 与复制语义**: 网页新增/复制的 SKU 属于工作区人工加工结果，统一写 `listingWorkspace.manualOverrides.manualVariants`，不得伪装成 canonical 采集事实；展示、定价、图片槽和渠道发布必须通过共享引擎的有效变体口径消费。复制必须生成新的稳定 ID 与 `offerSeq`，复制价格、库存、包装和规格轴覆盖，但不得继承来源 SKU 图片，图片使用 `manual::<variantId>` 独立槽；规格组合必须在采集与手工 SKU 全集中唯一。
- **渠道佣金自动匹配与快照复用**: Qingpu listing 的渠道佣金规则统一通过 `server/listing/commission` 下的 matcher factory 按渠道分发，不得把 Ozon 匹配逻辑继续散落在页面或 workspace query 中。选择平台类目后，规则包存在 mapping 时优先按精确 `categoryId:typeId`（再回退 type/category id）匹配，随后使用显式映射与置信度阈值名称匹配，并把渠道、平台类目标识、佣金 path/labels、价格档、费率、规则版本与来源保存为 `workspace.pricing.commissionBinding` 快照；相同类目必须复用自动或人工绑定，类目变化才重匹配，价格变化只在已绑定子类内重选档位。前端已绑定时默认收起人工选择器，仅在匹配失败或用户主动修改时展开；人工修改也必须走 revision-safe 串行提交与一次 `409 currentRevision` 重试。
- **密钥存储规则**: 主题私有授权 Key 表只保存 `api_key_hash` 与前缀/预览信息，原始明文 Key 仅允许在“创建 / 轮换”接口返回一次，不得持久化入库。
- **订阅关联建议**: 主题私有授权 Key 可以保存 APay 核心订阅 `subscriptionId`，并额外保存 `subscriptionSnapshot` 快照，避免后续套餐名称、金额或周期变更时丢失签发时上下文。

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

## 6.K 访客数据清理机制 (Data Cleanup)

> `2026-06-28` 新增。

### 设计原则

- **双表分离**：`visitor_events`（原始事件明细，可清理）与 `visitor_profiles`（访客画像聚合，永久保留）分开管理。
- **手动触发**：后台统计页提供清理按钮，由管理员按需执行，不自动定时执行。
- **可配置天数**：默认保留 90 天，支持 1~365 天范围。

### 清理范围

| 表 | 是否清理 | 原因 |
|---|---|---|
| `visitor_events` | ✅ 可清理 | 原始事件明细，存储开销大，适用于短期分析 |
| `visitor_profiles` | ❌ 永久保留 | 访客画像聚合数据，体积小，长期有价值 |

### API

- `POST /api/admin/stats/cleanup` — 接收 `{ days: number }`，删除 `days` 天之前的 `visitor_events`，返回 `{ deletedCount, keepDays, cutoff }`。

### 前端入口

后台 → 访客统计 → 底部「数据清理」卡片，输入保留天数后点击「清理旧事件」，弹出确认对话框后执行。

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
