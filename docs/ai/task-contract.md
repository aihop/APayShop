# APay AI 任务契约

本文是 `.ai/tasks/*.json`、文件租约和验证报告的流程事实源。目录布局见 `.ai/README.md`，命令行为以 `scripts/ai-task.mjs` 与 `scripts/ai-task-flow.mjs` 为准。

## 1. 它只做三件事

1. **范围**：用户确认过的 `claims` 是 AI 在本任务里唯一可改的路径；租约期间工作区出现 claims 之外的新增改动就阻断。
2. **验证**：契约声明的命令必须通过；报告只记录 claims 内文件的哈希。
3. **释放**：验证通过、claims 内文件在验证后没有再变化、由持有人释放，任务才算闭环。

其余一切（无关脏文件、别人的提交、系统元数据）都不是本任务的责任，脚本不会为它们阻断。

## 2. 适用范围

所有代码改动默认先建契约。发布、支付、价格、库存、数据库、鉴权、跨仓 vendor 和并发任务不得豁免。

纯分析、只读审计和不修改仓库的验证不建契约。只改错字或单页说明可省略；修改执行协议、架构事实源或跨仓流程时必须建契约。

## 3. 契约字段

必填：

| 字段 | 说明 |
|---|---|
| `schemaVersion` | 固定 `1` |
| `id` | 3–64 位小写字母、数字和连字符，与文件名一致 |
| `title` | 一句话说明任务 |
| `repositories[]` | `name`、`path`、`claims`；`claims` 是本任务实际租用并可修改的精确路径 |
| `verification[]` | `name`、`repository`、`command`；每个仓库至少一条。默认每次都跑，声明 `triggers` 则只在命中路径变化时跑 |

可选：

| 字段 | 什么时候写 |
|---|---|
| `allowedPaths` | 预先批准的扩围预算。声明后 `claims` 必须落在其中；之后在预算内追加 claims 不需要再次确认 |
| `problem` / `expectedOutcome` | 任务不是一眼能看懂时写，帮助用户确认目标 |
| `constraints` | 只写本任务特有的边界；AGENTS.md 已有的全局规则不要复述 |
| `acceptanceCriteria` | 用户可判断的结果；脚本原样记入报告，不做机器判断 |

路径只允许精确文件或以 `/**` 结尾的目录；禁止 `..` 和任意通配。仓库路径可用 `../qingpu-ai` 这类相对路径。存量契约里的 `covers` 字段被忽略，无需清理。

最小可用契约：

```json
{
  "schemaVersion": 1,
  "id": "fix-order-total-rounding",
  "title": "订单合计四舍五入口径统一",
  "repositories": [{ "name": "apay", "path": ".", "claims": ["server/utils/money.ts", "tests/money.test.ts"] }],
  "verification": [{ "name": "单测", "repository": "apay", "command": "npx vitest run tests/money.test.ts" }]
}
```

## 4. 生命周期与命令

```text
draft -> user-approved -> leased -> (extend | renew)* -> verified -> finished
                                 \-> abort
                                 \-> expired -> resume
```

```bash
npm run ai:check    -- --contract .ai/tasks/<task>.json                 # 只预检，不写运行态
npm run ai:prepare  -- --contract .ai/tasks/<task>.json --agent <name>  # 取租约，默认 480 分钟
npm run ai:complete -- --contract .ai/tasks/<task>.json --agent <name>  # verify + finish

node scripts/ai-task-flow.mjs extend --contract <path> --agent <name> [--confirm EXTEND:<task-id>]
node scripts/ai-task-flow.mjs renew  --contract <path> --agent <name> [--ttl 480]
node scripts/ai-task-flow.mjs abort  --contract <path> --agent <name>
node scripts/ai-task-flow.mjs resume --contract <path> --agent <name> --confirm RESUME:<task-id>
node scripts/ai-task.mjs status [--task <id>] [--reports 10]
```

- `prepare`：拒绝 claims 内已有脏改动、与其他活动租约重叠、重复 start；锁定契约摘要、各仓 HEAD 和脏文件基线。
- `extend`：先把新增路径写进契约 `claims`，再执行。新增路径在契约 `allowedPaths` 预算内则直接生效；超出预算必须先得到用户确认，再附 `--confirm EXTEND:<task-id>`。新增 claims 内已有的改动登记为本任务现场；旧验证报告失效。不能缩减 claims 或移除仓库。
- `renew`：延长到期时间，只有持有人能续。
- `abort`：释放租约并删除报告，工作区改动原样保留。
- `verify`：范围检查见 §5，然后执行命中的验证命令并写报告。
- `finish`：需要成功报告，且 claims 内文件哈希与报告一致；报告追加 `finishedAt` 后保留。

## 5. 范围规则

租约建立后，脚本把**工作区里 claims 之外的新增改动**视为越界并阻断 verify。

以下不算越界：

- 租约建立时已存在的脏文件；
- 其他活动租约 claims 覆盖的路径，即别人正在做的任务；
- 别人已经提交进 HEAD 的改动，提交有各自的授权；
- `.DS_Store`、`.ai/tasks/**`、`.tmp/**`。

越界时的处置：属于本任务就补进 claims 后 `extend`；属于其他会话就让对方 `prepare` 取得租约，或改用独立 worktree。不得手改租约、伪造基线或用更宽路径绕过。

## 6. 租约、过期与并行

- 租约存放在当前 worktree 的 `.tmp/ai-tasks/`，只协调同一 worktree 内的会话；不同 worktree 各自独立，冲突在合并时处理。
- 默认 480 分钟；快到期就 `renew`，不要重复 `prepare`。
- 已过期且 claims 干净：重新 `prepare`。已过期且 claims 有改动：用户确认后 `resume`，脚本把 claims 内现场登记为本任务改动。
- 验证失败：在 claims 内修复后重跑；根因超出 claims 就 `extend`。

## 7. 跨仓与完成定义

- 一份契约列出全部参与仓库，每仓至少一条验证。
- 引擎、主题与 APay 的发布顺序见 `docs/ai/cross-repository-development.md`。
- 契约验证不等于 Git 原子提交；最终提交元组需另行记录。

完成必须同时满足：claims 内有实际改动、没有越界改动、验证通过、验证后 claims 内文件未变化、租约由持有人释放、交付说明完整。

Git commit、push、外部写入、发布和生产迁移需要各自授权；`ai:complete` 不授予它们。
