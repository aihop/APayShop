# APay 工程约束

本文承载需要按任务加载的详细工程规则。根 `AGENTS.md` 只保留默认执行门禁；若本文件与根入口冲突，以根入口为准并同步修正文档。

## 1. 数据库与时间

### 1.1 三方言 Schema

- 数据库统一从 `@nuxthub/db` 导入 `db`。
- 核心 Schema 平行维护 `schema.sqlite.ts`、`schema.pg.ts` 和 `schema.mysql.ts`；字段与迁移必须同步。
- 核心 Schema 只包含 APay 直接使用的业务表。主题私有表、外部服务表和实验表通过 `tablesFilter` 或迁移范围隔离。
- JSON 字段写入必须兼容本地 SQLite 与云端 D1，不能假定单一方言行为。

### 1.2 时间与时区

- 数据库存 UTC 绝对时间；API 时间字段统一输出 UTC ISO 字符串。
- 前端使用 `useFormatTime()` 按 `settings.timezone` 渲染。
- Dashboard、Stats 等聚合复用 `server/utils/timezone.ts`，禁止使用服务器本地时间。
- SQLite `logs.created_at` 使用 `default(sql\`(unixepoch())\`)`；历史文本时间通过迁移修复。
- SQLite、PostgreSQL、MySQL 聚合 SQL 分别使用明确偏移、`AT TIME ZONE`、`CONVERT_TZ`。

### 1.3 ainode JSON

修改 ainode Schema 或查询后必须运行 `sqlc generate`。`sqlc.yaml` 必须包含：

```yaml
emit_json_tags: true
json_tags_case_style: camel
```

API 与前端统一 camelCase；手写 db struct 不得重复定义 sqlc 模型。

### 1.4 用户与钱包

- `users` 只承载 APay 身份与登录状态；资金、钱包状态、套餐等级和订阅到期时间归 `user_wallets`。
- APay 当前每个用户只有一个本地钱包，`user_wallets.user_id` 保持唯一；所有余额流水同时记录 `user_id` 与非空 `wallet_id`。
- APay 与 AINode 使用独立数据库，各自拥有自己的 `user_wallets`；不得共享、直连或互相镜像钱包表。
- APay 充值、退款和本地展示只操作 APay 钱包；AINode 四池消费与余额展示继续通过 AINode API 获取。

## 2. Nuxt 与主题

- 多主题 Catch-all 与后台扩展扫描使用 `import.meta.glob(..., { eager: true })`，保证 SSR SEO 与构建映射。
- 主题后台页通过 `theme.admin.json` 和 `admin/pages/` 注册，统一承载于 `/admin/extensions/*`。
- 主题后台接口标准地址是 `/api/admin/[theme]/**`，必须进入全局管理员鉴权。
- 主题后台文案放 `locales/admin/`；直连 ainode 管理接口优先复用 `useExternalApi({ proxy: true })`。
- 图片上传同时兼容本地 `uploads/` 与 `hubBlob()`。
- 与官网主题绑定的外部产品集成由对应主题通过 `theme.admin.json`、`admin/pages/` 和 `/api/admin/[theme]/**` 承载；Provider 专属字段、路径与适配器留在主题内部，不能进入 APay 核心 Schema。只有与任何主题生命周期都无关的宿主能力才进入根 `modules/<name>/`，且不得借模块注册主题后台入口。凭证只保存在服务端，外部业务写操作必须逐能力声明幂等、审计与回滚边界。

## 3. 前端约定

- Nuxt UI 已提供的功能优先使用原生 prop；通用组件不使用 `Common` 前缀。
- 弹窗使用 `v-model:open` 和 `<template #content>`。
- 列表分页统一使用 `usePagination()`；页码更新调用 `onPageChange(refresh)`。
- 导航、用户中心和通知列表统一消费 `useNotificationState()`；身份变化时刷新或清空。
- 官网微信登录走 Shoply `/auth/connect`；PC 扫码和微信内 H5 使用各自凭据。

## 4. 支付、订单与记账

### 4.1 信任边界

- 支付 create/callback/query 脚本当前由 `AsyncFunction` 执行，只能视为“可信管理员动态脚本”，不是安全隔离边界。
- 未迁移到独立进程前，禁止允许低信任角色写脚本；不得扩大脚本宿主对象、文件系统、环境变量或网络能力。
- 支付状态、金额、币种、签名、回调幂等或履约修改必须进入高风险验证。

### 4.2 Minimal relay topup

- Qingpu 支付写入 `metaData.checkoutBridge`，锁定支付、来源换算和充值口径。
- `orders.source='minimal_checkout' + externalOrderId` 是跨系统唯一幂等键。
- 中转订单统一走 `fulfillMinimalCheckoutRelay()`，不进入普通 `fulfillOrder()`。
- 有 `notifyUrl` 时只发送 `minimal.checkout.paid`；失败不得切换第二通道。

### 4.3 币种快照

- `settings.currency` 是基础/兜底币种，汇率方向固定为 `1 基础币种 = rate 目标币种`。
- `orders.amount/currency` 只表达实付；内部入账读取 `currencySnapshot` 基础金额。
- 支付插件声明币种后，支付列表和发起接口都必须校验订单币种。

### 4.4 本地支付插件

- `payments/[code]/create.js`、`callback.js`、`info.html`、`config.json` 由主链自动加载。
- 微信插件使用 PC Native + 手机 H5；支付宝使用 PC page + 手机 wap。

## 5. Promo 与履约

- Promo tracking 首次访问捕获，注册和下单再次 read + capture；合并使用非空优先。
- 代理关系使用 `pending / active / disabled`；团队统计只包含 `active`。
- 商品履约统一由 `server/utils/fulfillment.ts` 处理 `basic/key/file/subscription/service/topup`。
- 0 元订单未配置上限时默认每用户限购一次；显式 `perUserLimit=0` 才表示不限。

## 6. Qingpu 主题私有边界

- 主题 API、私有 PG、查询与 SQL 分别放在 `api/`、`server/`、`database/`。
- Qingpu 私有表不得进入 APay 核心 Schema；授权 Key 只存 hash 与预览。
- 用户设置放 `qingpu_settings.config`，少量全局状态放 `qingpu_kv`。
- 资源使用 `deleted_at` 软删，资产使用 `media_type(image|video)`。
- 1688 直抓保存 ainode 原始 payload；canonical、workspace 和渠道草稿不得互相冒充。
- SKU 编辑走 revision-safe mutation；删除写 `excludedSkuIds`，手工 SKU 写 `manualVariants`。
- 三端共享口径来自 Qingpu engine。跨仓发布见 `docs/ai/cross-repository-development.md`。

更细的 Listing 行为以主题 `AGENTS.md`、用户文档和引擎专项文档为准。

## 7. 依赖与验证

- 禁止新增 C++ 或 Node 原生绑定依赖；新依赖必须兼容目标部署环境。
- APay 已有 AI 契约自测与专项守卫，但尚无完整业务测试框架；构建通过不等于订单、支付和履约已验证。
- 后端或跨模块逻辑至少运行专项守卫和 `npm run build`，并明确手工验证与未覆盖项。
- 支付、发布和生产迁移默认 dry-run。
