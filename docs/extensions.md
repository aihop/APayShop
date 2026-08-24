# APay 扩展开发

APay 扩展是随源码构建部署、可同时启用多个的可信业务能力。扩展不同于单选主题，也不同于 Nuxt 的 `app/plugins/` 和 Nitro 的 `server/plugins/`。

## 目录与入口

```text
app/extensions/<extension-id>/
  extension.json
  admin/pages/
  user/pages/
  api/admin/
  api/user/
  database/
    sqlite/
    postgresql/
    mysql/
```

固定命名空间如下：

| 能力 | 路径 |
|---|---|
| 后台页面 | `/admin/plugins/<extension-id>/<page-key>` |
| 用户页面 | `/user/plugins/<extension-id>/<page-key>` |
| 后台 API | `/api/admin/plugins/<extension-id>/<manifest-path>` |
| 用户 API | `/api/plugins/<extension-id>/<manifest-path>` |

扩展不能注册任意根路由或覆盖核心、主题页面。后台页沿用 APay 后台壳；用户页要求登录。

## Manifest

`extension.json` 使用 `schemaVersion: 1`，扩展目录名必须与 kebab-case `id` 一致。Manifest 声明：

- `capabilities`：后台授权单元，生成 `plugin:<id>:<capability>:view|edit` 权限。
- `adminPages` / `userPages`：页面组件和固定页面 key。
- `adminApis` / `userApis`：HTTP 方法、相对路径和 handler。
- `defaultEnabled`：数据库尚无 `enabled_extensions` 设置时的初始状态；仅无迁移扩展可使用，带迁移扩展必须显式启用。
- `database.migrations`：按 ID 排序的私有迁移，以及 SQLite、PostgreSQL、MySQL 三方言 SQL 文件。

后台页面和它调用的后台 API 必须引用同一个 capability。后台 API 由全局管理员鉴权按 HTTP 方法检查 view/edit；用户 API handler 必须显式调用 `requireUserSession()`。

## 构建与启停

新增或修改扩展后运行：

```bash
node scripts/generate-extension-build.mjs
node scripts/check-extension-system.mjs
```

生成器校验 manifest、组件、handler、ID、重复路由、capability 和三方言迁移，并把迁移 statement 与 SHA-256 固化进 `server/utils/extensionRegistry.generated.ts`，同时生成客户端 checksum 要求 `app/extensions/extensionDatabase.generated.ts`，兼容 Node、Cloudflare/D1 和无运行时文件系统的构建。专项守卫会重新生成并比较 registry，未同步时直接失败。禁止手改生成文件。

后台“设置 → 扩展”先显示当前方言的迁移状态。管理员显式执行全部待处理迁移后才能启用；迁移失败保持停用并可重试，已执行 SQL 的 checksum 变化会硬阻断。宿主使用 `settings` 保存迁移 checksum、公开的已应用 ID 摘要和短期并发锁，不把扩展业务表加入 APay 核心 Schema。

迁移 ID 使用 `0001-create-records` 格式，已执行文件禁止修改，只能追加更大的 ID。SQL 中创建或修改的表必须使用 `ext_<extension_id>_` 前缀，语句用 `--> statement-breakpoint` 分隔；禁止显式事务和 `DROP TABLE/COLUMN/DATABASE/SCHEMA`。PostgreSQL 单个迁移由宿主事务包裹；SQLite/D1 与 MySQL 迁移必须自行保持可重入，因为部分部署环境无法保证 DDL 整体回滚。

禁用只关闭页面和 API，不删除代码、迁移账本或私有数据。保存失败保留旧启用列表；迁移失败时先把未记账的失败迁移修成可重入、向前执行的 SQL 再重试，已记账的迁移仍禁止修改。部署失败回退上一构建产物，但不得回滚已提交的数据迁移；旧代码必须能容忍已新增的表和列。

## 安全边界

- 扩展与宿主进程同权，只允许审查过的可信源码。
- 不支持 ZIP 上传、在线安装、动态执行第三方代码或公开市场。
- 扩展不能修改 APay 核心 Schema；私有表和迁移归扩展目录所有，只能由宿主管理员迁移入口执行。
- 支付、订单、价格、库存与履约接入必须通过宿主领域能力，并单独声明幂等、审计和回滚边界。
