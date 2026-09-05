# AGENTS.md - APay 工程执行入口

> 本文件是所有 AI 编码工具默认加载的仓库级入口，只保留执行门禁、系统边界和文档路由。业务细节与历史变化按任务加载，不再继续堆入本文件。

## 0. 指令与事实源

发生冲突时按以下顺序处理：

1. system / developer / 用户当前明确指令；
2. 用户已确认的当前任务契约；
3. 本文件；
4. 本文件文档地图指向的专项文档；
5. 当前代码与历史习惯。

文档与代码冲突且无法判断目标状态时停止并请求确认，不得把现有实现自动当作正确规格。

## 1. 项目与边界

APay 是 Nuxt 4 + NuxtHub 的虚拟商品独立站，也是 SaaS 矩阵的计费中心与引流门户。业务代码在 `app/`，服务端在 `server/`，内容文档固定在根 `content/`。

核心边界：

- APay 负责商品、订单、支付、订阅、履约、推广和主题宿主能力。
- Qingpu 的铺货、图片、渠道和私有租户数据属于主题私有模块；不得污染 APay 核心 Schema。
- Shoply 等外部系统通过幂等 Webhook/事件完成最终业务，APay 不直接操作其业务数据库。
- 主题可扩展后台页面，不接管核心 `/admin` 壳、登录和全局鉴权。

## 2. 开发流程

### 2.1 开工前

1. 读取本文件、`git status` 和相关专项文档。
2. 区分用户改动、其他任务改动和本任务范围；不得覆盖或混提无关内容。
3. 代码任务先按 §7.A 建立任务契约，经用户确认后取得 claims 文件租约。
4. 涉及支付、发布、价格、库存、数据库、鉴权或跨仓 vendor 时，必须写出失败与回滚边界。

### 2.2 实现原则

- 修根因，保持最小范围；未经批准不做跨目录重构、数据迁移、公共 API 删除或新依赖引入。
- 新规则必须有执行机制：迁完存量、加入机器守卫，或登记明确技术债；只写文档不算完成。
- 不用 `any`、大面积断言、静默吞错或伪造外部字段掩盖问题。
- API 变更同步更新 `content/docs/` 与 `content/zh/docs/` 对应文档。

### 2.3 停止条件

- 目标存在多个会影响数据模型、协议、支付或发布链的合理方案；
- 需要删除数据、修改生产状态、扩大外部权限或执行不可逆操作；
- 外部 API/平台规则无法从代码、样本或权威文档确认；
- 扩围超出契约 `allowedPaths` 预算且用户尚未确认、租约冲突或工作区无法安全隔离；
- 验证失败且根因指向更高层方案错误。

## 3. 系统硬边界

- `/admin/**` 与 `/api/admin/**` 必须受管理员鉴权；主题后台 API 使用 `/api/admin/[theme]/**`。
- 支付脚本当前是可信管理员能力，不是真正的安全沙箱；不得向低信任角色开放脚本写入，也不得扩大宿主与网络能力。
- 订单支付口径、基础币种记账口径和外部充值口径必须分离并锁定快照。
- 跨系统写入必须有稳定幂等键；接收成功但响应丢失时不得切换第二通知通道造成重复入账。
- 上传、数据库、运行时依赖必须兼容目标部署环境；禁止新增 C++ 或 Node 原生绑定依赖。

详细规则见 `docs/engineering-constraints.md`。

## 4. 数据库与时间

- `db` 从 `@nuxthub/db` 导入。
- APay 核心表平行维护 `schema.sqlite.ts`、`schema.pg.ts`、`schema.mysql.ts`；字段和迁移必须三方言同步。
- 主题私有表、外部 Go 服务表和实验表不得加入核心 `server/db/schema.*`。
- 数据库存 UTC，API 输出 UTC ISO，前端通过 `useFormatTime()` 按配置时区显示。
- 时间聚合按数据库方言分支并读取 `settings.timezone`，禁止依赖服务器本地时间。

## 5. 前端与主题

- 多主题页面与后台扩展扫描使用 eager glob，保证 SSR SEO 与构建映射完整。
- Nuxt UI 已有能力优先用原生 prop；弹窗用 `v-model:open` + `#content`；分页统一用 `usePagination()`。
- 通用组件按业务语义命名，不使用 `Common` 前缀。
- 通知未读数统一消费 `useNotificationState()`，身份变化时刷新或清空。
- 主题后台扩展通过 `theme.admin.json` 注册；后台文案放主题 `locales/admin/`。

## 6. 领域约束

### F. 支付与 Minimal relay

- `orders.amount/currency` 表示实付；订阅、履约、结佣和外部入账读取 `currencySnapshot` 基础金额。
- Qingpu 中转订单使用 `source='minimal_checkout' + externalOrderId` 唯一幂等键，统一走 relay fulfillment，不进入普通本地商品履约。
- 有 `notifyUrl` 时只发 `minimal.checkout.paid`；未配置才回退通用事件，失败不得换通道。
- 支付插件声明币种后，展示与发起接口都必须校验订单币种。

### G. Schema 与 Promo

- APay Schema 只包含本项目直接使用的核心表；共享数据库通过过滤器隔离外部模型。
- Promo tracking 首次访问即捕获，注册/下单再次合并；空 query 不得覆盖 Cookie 中已有来源码。
- 代理关系使用 `pending / active / disabled`，团队统计只包含 `active`。

### H. 验证现状

APay 已有 AI 契约自测与部分专项守卫，但尚无完整业务测试框架。构建通过不等于支付、订单和履约已验证；代码修改按契约运行专项检查与 `npm run build`，并记录手工走读范围。

### I. 时间与时区

UTC 存储、API ISO 输出、配置时区聚合与前端渲染的完整规范见 `docs/engineering-constraints.md` §1.2。

### J. ainode JSON

sqlc 开启 `emit_json_tags` 和 `json_tags_case_style: camel`；修改查询后重新生成，API 与前端统一 camelCase。

### L. Qingpu 主题私有模块

- 主题 API、私有 PG、SQL 和业务服务分别放在 `app/themes/qingpu/api/`、`server/`、`database/`。
- canonical 事实、workspace 加工和渠道草稿严格分层；软删、任务、设置、资产和 SKU 语义见专项文档。
- 三端共享的状态、SKU、定价、图片任务和发布口径来自 `qingpu-ai` engine，主题禁止复制实现。
- 跨仓所有权、版本锚点与发布顺序只以 `docs/ai/cross-repository-development.md` 为准。
- 主题内部执行规则见 `app/themes/qingpu/AGENTS.md`。

## 7. 国际化、文档与 AI 门禁

- 新增/修改 API 同步更新英文与中文 API 文档。
- 产品历史迁至 `docs/changelog.md`；不得把业务 Changelog 重新堆回本文件。

### A. AI 任务契约流程（最高开发门禁）

所有代码任务及高风险执行文档调整都必须：

1. 创建 `.ai/tasks/<task-id>.json`，至少声明 `id`、`title`、各仓 `claims` 与 `verification`；预计会追加路径就先声明 `allowedPaths` 作为预算；
2. 用户确认后运行 `npm run ai:prepare -- --contract <path> --agent <name>`；
3. 只修改 claims；需要新路径先补进契约再 `extend`，超出 `allowedPaths` 预算时先征得用户确认；快到期 `renew`，做不下去 `abort`；
4. 运行 `npm run ai:complete -- --contract <path> --agent <name>`，验证通过并释放租约才算完成。

范围检查只看 claims：其他活动租约的路径、别人已提交的改动和系统元数据不算越界。`.ai/` 目录结构见 `.ai/README.md`；字段、命令、过期与恢复见 `docs/ai/task-contract.md`。`ai:complete` 不授权 commit、push、发布或生产迁移。

## 8. 交付与自审

交付至少说明：改动文件及目的、验证结果、风险、未覆盖项和建议下一步。纯文档任务还要说明事实源如何调整、哪些旧描述仅保留为历史。

完成前检查：

- 是否修改了契约外文件或覆盖他人改动；
- 是否把业务事实放回了根执行入口；
- 是否同步 API/Schema/多语言/跨仓消费者；
- 是否把警告、手工验证或部分通过说成完整通过。

## 9. Git 提交流程

- 先 `git status` 核对范围，只 add 本任务文件；工作区有并行改动时禁止 `git add -A`。
- 提交前运行契约验证和 `git diff --check`；不修改或整理他人未提交内容。
- 不自动提交、推送、拉取、变基或发布，除非当前用户指令或已确认流程明确授权。
- Qingpu 主题是独立 Git 仓；父仓 add/commit 不能代替主题仓提交。跨仓提交元组见 `docs/ai/cross-repository-development.md`。

## 10. 文档地图

| 任务 | 必读 |
|---|---|
| APay 数据库、时间、支付、Promo、Nuxt/主题细节 | `docs/engineering-constraints.md` |
| `.ai/` 目录、任务契约与运行态边界 | `.ai/README.md` |
| AI 契约、租约、验证、过期与恢复 | `docs/ai/task-contract.md` |
| Qingpu engine、主题、APay 跨仓开发 | `docs/ai/cross-repository-development.md` |
| Qingpu 主题内部开发 | `app/themes/qingpu/AGENTS.md` |
| Qingpu Listing 用户/API 行为 | `content/docs/12.qingpu-listing-products.md` 与中文对应文档 |
| 历史工程约束变化 | `docs/changelog.md` |
| AI 提示词/协作方法历史材料 | `docs/ai/` 下对应专项文档 |

最终原则：先明确事实源和边界，再实现；先获得验证证据，再声明完成。
