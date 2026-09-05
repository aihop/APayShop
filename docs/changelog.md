# APay 工程约束变更记录

本文件记录曾影响开发约束、数据契约或跨系统边界的变化。它是历史索引，不是当前执行协议；当前规则以根 `AGENTS.md` 及其文档地图指向的专项文档为准。

## 2026-09

- `2026-09-05`：AI 任务契约瘦身：`allowedPaths` 改为可选的扩围预算，`problem / expectedOutcome / constraints / acceptanceCriteria` 可选，`covers` 不再读取；越界只看工作区里 claims 之外的新增改动，其他活动租约、他人已提交的改动与 `.DS_Store` 不算越界；`finish` 只校验 claims 内文件哈希；新增 `extend / renew / abort`，租约默认 480 分钟。存量契约无需迁移。

## 2026-08

- `2026-08-07`：根 `AGENTS.md` 收口为短版执行入口；详细工程规则迁至 `docs/engineering-constraints.md`，AI 任务契约迁至 `docs/ai/task-contract.md`，Qingpu 跨仓协作迁至 `docs/ai/cross-repository-development.md`。
- `2026-08-06`：本地 AI 任务契约成为仓库级开发门禁：代码任务先写独立契约，经用户确认后通过 `ai:prepare` 取得文件租约，完成后通过 `ai:complete` 验证并释放。
- `2026-08-05`：Qingpu 1688 采购成本以逐 SKU 原始报价为事实值；同步入口从 ainode raw 重建并补回被历史客户端裁剪的 canonical SKU，补回项转写 `excludedSkuIds` 以保留用户选择，并提供幂等历史修复脚本。

## 2026-07

- `2026-07-29`：Qingpu 买家侧预览统一消费服务端归一化草稿快照；前端不再猜测私有资产 ID。
- `2026-07-29`：Qingpu Listing 划线价使用用户级 `oldPriceMarkupRate`，默认 30%；服务端转换为引擎 `frontDiscountRate` 并写入 workspace 定价快照。
- `2026-07-29`：前台通知统一消费 `useNotificationState()` 全局未读数。
- `2026-07-29`：Qingpu 网页铺货支持新增与复制 SKU；手工 SKU 写入 `manualVariants`，复制使用独立空图片槽。
- `2026-07-28`：主题后台 API 标准命名空间收口为 `/api/admin/[theme]/**`。
- `2026-07-28`：`minimal` 成为 APay 唯一支付中转层；Qingpu 订单统一按 relay topup 记录支付、换算和充值口径。
- `2026-07-28`：新增语言绑定普通商品结算币种与汇率；订单保存支付口径和基础币种快照。
- `2026-07-28`：Qingpu 新增渠道佣金匹配器工厂；结果与规则版本写入 workspace 快照。
- `2026-07-28`：Qingpu SKU 编辑统一为 revision-safe mutation；删除 SKU 写入 `excludedSkuIds`。
- `2026-07-25`：加固 Admin Setup：原子初始化、用户名与密码强度校验、公开端点限流及状态预检。
- `2026-07-25`：新增 0 元订单直通过账和每用户购买次数上限。
- `2026-07-23`：Qingpu 资产使用 `media_type(image|video)`；通用 AI 工具复用 `qingpu_tasks` 与 `qingpu_assets`。
- `2026-07-23`：新增 `qingpu_kv`；1688 直抓保存 ainode 原始 payload；新增支付宝 page/wap 插件模板。
- `2026-07-22`：新增 Promo 会员邀请、两级代理和 `pending / active / disabled` 状态。
- `2026-07-22`：Promo tracking 首次访问捕获，注册/下单再次 read + capture，并使用非空优先合并。
- `2026-07-20`：Qingpu 铺货资源统一使用 `deleted_at` 软删。
- `2026-07-19`：Qingpu 用户级工作台偏好收口到 `qingpu_settings.config`。
- `2026-07-06`：Qingpu 私有 PostgreSQL 表与客户端不得并入 APay 全局 Schema。

## 2026-06 及更早

- `2026-06-28`：后台支持清理 `visitor_events` 原始事件，默认保留 90 天；`visitor_profiles` 永久保留。
- `2026-06-27`：确立 UTC 存储、API 输出 UTC ISO、前端按配置时区渲染的时间规范。
- `2026-06-27`：ainode sqlc 开启 JSON tag，小驼峰输出成为统一 API 约定。
- `2026-06-26`：旧充值商品语义重构为 `topup`，并移除 APay 本地 API Key 资产模型。
- `2026-05-30`：增加 Git 提交流程、后台时间字段归一化和 SQLite `logs.created_at` 修复约定。
- `2026-05-29`：补充测试策略并修正章节编号。
