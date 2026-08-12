# 员工子账户 + 套餐配额:交接说明

本文给接手这条线的人/AI。**先读完再动手**——下面的决定都是排除掉更贵的方案之后收敛的，重新推一遍大概率会推歪，而且好几个坑是静默出错、不报错的。

流程照 `.ai/README.md`:每项任务先建契约、经用户确认、`ai:prepare` 取租约、只改 claims、`ai:complete` 验证释放。契约已经写好，见下表。

---

## 1. 已完成

### `qingpu-employee-subaccount` — 员工实体、登录与权限闸门（主题侧）

验证全过，租约已释放。

| 文件 | 作用 |
|---|---|
| `app/themes/qingpu/database/employees.sql` | `qingpu_employees` 表 |
| `server/employees/access.ts` | 访问闸门，默认拒绝 |
| `server/employees/{helpers,queries}.ts` | 类型、店铺码、校验、数据访问 |
| `server/employees/session.d.ts` | `#auth-utils` 模块增强（主题内） |
| `api/employees/{index,update,status,login}.ts` | 店主管理 + 员工登录 |
| `server/shared/resolveApiUserId.ts`（改） | 返回 `employeeId`/`role`、挂闸门、每请求复核状态 |
| `server/db/pg.ts`（改） | 自检清单加表 |
| `scripts/check-employee-access-gate.mjs` | 不变量守卫 |

**APay 主仓零改动。**

### `apay-product-meta-presets` — 商品字段预设机制（核心侧）

验证全过，租约已释放。核心 admin 可按商品类型声明自定义字段，渲染在固有控件之下，值写入 `products.meta_data`。**后端零改动**（复用 `/api/admin/settings` 通用 upsert，存 `product_meta_presets` 键）。

两项都**未提交、未推送、未在浏览器里跑过**——只有 `nuxt typecheck` 和静态事实检查通过。

---

## 2. 剩余任务

| 契约 | 做什么 | 依赖 |
|---|---|---|
| `qingpu-plan-quota` | 员工数/店铺数配额的读取与强制 + 主题自带预设一键安装 | 预设机制（已完成） |
| `apay-product-form-split` | 把 `ProductFormModal.vue`(569) 和 `useAdminProductForm.ts`(612) 拆到 500 行以内 | 无 |
| `qingpu-employee-extension` | 员工二期：扩展端凭证归属 + 人均 AI 额度 | 员工一期（已完成） |

还没写契约的（需求更模糊，建议做到这一步再定）：

- **员工前端页面**（三期）：员工管理页、员工登录页。现在只能用 curl。
- **商品数配额**：写入点在 `server/listing/queries.sync.ts` 的批量 upsert 循环，带 LWW 守卫、墓碑行、revision 水位。要处理"一批过一半"的部分接受语义、区分新建与更新、排除墓碑行，卡不好会让扩展的同步循环反复重试。**和店铺/员工那种单条创建完全不是一个难度，务必单独一期。**
- **存储体积配额**：本期明确不做。理由见 §3.7。

---

## 3. 架构决定与理由

### 3.1 账户就是 `users.id`，不建账户表

`qingpu_settings` 是 `user_id bigint primary key`——一行一个账户，账户级配置已经有家了。11 张业务表全按 `user_id` 隔离。

所以**没有 `accounts` 表，也没有 `account_id`**。店主在 `qingpu_employees` 里也**没有行**——只有员工才有行，一个没请员工的店主该表 0 行。

副作用（重要）：**不需要任何回填迁移**。老用户的代码路径一次查询都没多。

排除的方案：给 11 张表加 `account_id` + 迁唯一约束 + 改 85 个端点，而 ainode 那边仍是 user/email 口径，会得到"业务按 account 隔离、钱包按 user 计费"的分裂状态。

### 3.2 员工是独立实体，不是一把 key

`server/tenant-keys/issue.ts` 的注释写着 Chrome + Electron 双端是**本产品的标配用法**。所以员工 : key = 1 : N。

把人身份挂在 key 上的后果：改权限要 UPDATE N 行、离职要 revoke N 行、**漏一行就是没撤干净**（安全问题）。凡是 1:N 的"一"，就得有自己的行。

### 3.3 `userId` 恒为店主 —— 整个方案的安全支点

`resolveApiAuth` 返回的 `userId` **永远是数据归属者（店主）**，员工身份走独立的 `employeeId` 字段。

全主题 85 个端点都读 `userId`，因此**默认行为天然正确**，不依赖各处记得区分。

**改任何东西都不要破坏这条。** `resolveApiUserId.ts` 里有一道复核：`employee.ownerUserId !== session.user.id` 直接 401，防的就是有人手滑把员工 id 写进 `session.user.id`。守卫脚本静态锁了这条。

### 3.4 权限用白名单 + 默认拒绝

权限走 `server/shared/resolveApiUserId.ts`，用路径前缀白名单。

**「它是唯一鉴权入口」不是天然事实，是靠守卫维持的不变量。** 这条最初写错过：文件注释声称「全部 84 个 API 都经过本函数」，实际有 7 个端点（`api/ainode/site/*` 与 `api/tenant-keys/{detail,rotate,revoke}`）直接调核心的会话工具，完全绕过闸门——而员工会话的 `session.user.id` 就是店主 id，绕过即放行，员工因此能读店主账单并吊销其设备凭证。已修复，并由 `check-employee-access-gate.mjs` 全目录扫描把守。**新增端点必须走 `resolveApiAuth`，否则守卫会失败。**

漏加规则的表现是员工干不了某件事（店主立刻反馈）；反过来逐个端点加校验，漏一个就是一个洞且没人会发现。**方向不能反。**

**路径前缀是 `/api/qingpu/**`，不是 `/api/**`**（见根 `nuxt.config.ts` 的 nitro handlers 组装）。写错前缀会 fail-closed 成"员工什么都干不了"。

### 3.5 员工登录端点在主题，不在核心

`server/db/pg.ts` 的连接串是 `QINGPU_DATABASE_URL || ... || DATABASE_URL`——**主题库可能是独立数据库**。让核心去查 `qingpu_employees` 等于宿主反向依赖主题内部，换主题就悬空。

主题本来就有 `api/login.ts`、`api/register.ts` 这类自有登录入口的先例。主题只使用宿主公开的 `setUserSession`。

### 3.6 配额定义放 `products.meta_data`，靠预设系统填

排除"主题私有配额表"的理由：套餐定义会分两处（价格在核心 products、额度在主题表），建新套餐要记得配第二步。

排除"往核心表单加 `max_stores` 控件"的理由：`ProductFormModal.vue` 里每个 meta 键都写死一个控件，**且没有任何通用 JSON 编辑入口**——加控件就是让核心去认识只有 qingpu 懂的概念。

最终解：核心提供**通用预设机制**（按类型声明字段），主题提供**预设内容**。核心源码里永不出现 `max_stores`——契约里有一条验证专门锁这个：

```
! rg -q 'max_stores|max_employees' app server
```

### 3.7 ainode 只管钱

| 归属 | 管什么 |
|---|---|
| **ainode** | 余额、预扣、结算、`api_keys.quota_limit`（AI 消费上限） |
| **qingpu** | 店铺数、员工数、商品数 |

所以**存储体积配额不做**：体积数据只在 ainode 的 `storage_objects.bytes`，主题侧完全不知道（`qingpu_assets` 只存 URL，没有 bytes 列）。

注意别用错理由说服自己：**"图片要花钱生成所以钱封顶了存储"是错的**——`storage_objects.source` 有 `upload | image_task` 两种，采集来的图走 upload，不产生 AI 费用。真正间接封顶存储的是**商品数**。

### 3.8 缺配额键 = 不限制

反过来做（缺键回退到默认下限）会在上线瞬间把**所有存量付费用户夹死**，因为那时还没有任何产品填过配额。

功能上线即惰性，靠配置开启。配套的是**软超限**：存量超额的店铺/员工保留可用，只拦新建。

---

## 4. 会静默出错的坑

按危险程度排：

1. **邮箱身份空间相交 → 扣错钱包。**
   `server/ainode/site.ts:25` 是**拿邮箱去 ainode 找/建用户**。员工登录名因此**刻意不用邮箱**（`login_name` 正则不接受 `@`），否则员工本人若也是本站注册用户，会解析出独立的 ainode 用户和独立钱包，请求照常成功、钱扣在错的账本上、**不报错**。

2. **`persistModelCredentials` 会覆盖店主的 AI key。**
   它写 `qingpu_settings`（`user_id` 主键，一行一个用户）。员工的 ainode key 必须存 `qingpu_employees.ainode_api_key_id`。

3. **`DEVICE_KEY_CAP = 5` 会静默踢掉员工。**
   `issue.ts` 里每次登录发新 key、超过 5 把撤销最旧的。不把作用域改成按人算，店主多登几次就把员工的 key 撤了，员工那边突然全线 401 且无提示。二期必须一次梳完四条路径（cap / 续期 / trial / revokeAll）。

4. **缺表让全站 503。**
   `qingpu_employees` 已进 `REQUIRED_TABLES`。建表 SQL 没应用之前，主题**全部 84 个 API 一律 503**。部署顺序见 §5。

5. **`ensureAINodeApiKey` 的"只在首次创建"guard。**
   直接复用会让第二个员工建不出 key。

6. **`AINODE_MODEL_GROUP_ID = 6`。**
   员工 key 不进这个组，建得出来但一调模型就报错。

7. **子目录组件必须显式 import。**
   Nuxt 自动导入会带路径前缀，模板里用短名解析不到，表现为**整块 UI 静默不渲染**（`ProductFormModal.vue` 顶部注释记着这个事故）。拆分那一期尤其注意。

8. **改 locale JSON 别整份重新序列化。**
   这些文件有大量"一行多键"的紧凑排版，`JSON.stringify` 会全部拆开，制造上百行无关 diff。用文本插入。

---

## 5. 部署顺序

```
1. yarn db:qingpu:init        # 建 qingpu_employees(哪怕一个员工都没有)
2. 发代码
```

**顺序反了会让主题全部 API 返回 503。**

`database/employees.sql` 会被 `scripts/apply-qingpu-sql.mjs` 自动捡到（`listSqlFiles` 的 extras 分支），不需要手工登记；`parseExpectedTables` 也会自动把新表纳入应用后自检。

SQL **目前没有在任何数据库上跑过**，语法未经真实验证。

---

## 6. 工程约束

- **500 行**：单个代码文件不超过 500 行。`ProductFormModal.vue`(569) 和 `useAdminProductForm.ts`(612) 目前超标，`apay-product-form-split` 契约专治。apay 侧**没有**自动门禁（ainode 的 `make check` 才有），靠自觉。
- **跨仓分工**：APay 主仓管宿主/支付/订单/认证/主题装配；主题仓管 Qingpu UI、主题 API、私有 PostgreSQL、任务执行、vendor。详见主题 `AGENTS.md` 与 `docs/ai/cross-repository-development.md`。
- **主题新增主仓依赖**要经 `server/shared/` 收口，别再加五层相对路径直连。员工登录端点复用了现成的 `server/shared/adminUsers.ts` 的 `getUserBriefsByIds`。
- **契约流程**：租约期间契约摘要锁定，不能原地扩围，脚本没有 `abort/renew/resume`。发现范围写错时保留现场、停下报告，由用户决定；不要手改 `.tmp/ai-tasks/` 下的租约或报告。
