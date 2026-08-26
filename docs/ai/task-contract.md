# APay AI 任务契约

本文是 `.ai/tasks/*.json`、文件租约和验证报告的流程事实源。`.ai/` 目录布局与维护规则见 `.ai/README.md`，命令行为以 `scripts/ai-task.mjs` 与 `scripts/ai-task-flow.mjs` 为准。

## 1. 适用范围

所有代码改动默认先建独立契约。发布、支付、价格、库存、数据库、鉴权、跨仓 vendor 和并发任务不得豁免。

纯分析、只读审计和不修改仓库的验证不建契约。只改错字或单页说明可省略；修改执行协议、架构事实源或跨仓流程时必须建契约。

## 2. 生命周期

```text
draft -> user-approved -> leased -> verifying -> verified -> finished
                    \-> expired / blocked（人工处置结果，脚本不持久化该状态）
```

- `draft`：只创建或调整契约，不先改声明的目标文件。
- `user-approved`：用户明确同意目标、范围和验证口径；批准证据保留在对话中。
- `leased`：`ai:prepare` 锁定契约摘要、仓库 HEAD、既有脏文件和 claims。
- `verified`：报告绑定契约摘要和仓库状态；验证后变化会使报告失效。
- `finished`：同一 agent 通过 `ai:complete` 释放租约；报告保留。

## 3. 契约字段

- `id`：3–64 位小写字母、数字和连字符。
- `title/problem/expectedOutcome`：任务、现状问题和可观察结果。
- `constraints`：不可突破的安全、兼容和范围边界。
- `repositories`：声明 `name/path/allowedPaths/claims`。
- `allowedPaths`：允许触及的最大边界；`claims` 是实际取得租约的精确路径。
- `acceptanceCriteria`：用户可判断的结果。
- `verification`：命令、仓库、`always` 或触发路径；每个 claim 必须被完整覆盖。

仓库内路径只允许精确文件或以 `/**` 结尾的目录；禁止 `..`、任意通配和模糊大目录租约。仓库自身路径可使用 `../qingpu-ai` 这类相对路径。

## 4. 标准命令

```bash
npm run ai:check -- --contract .ai/tasks/<task>.json
npm run ai:prepare -- --contract .ai/tasks/<task>.json --agent <name>
# 只修改 claims
npm run ai:complete -- --contract .ai/tasks/<task>.json --agent <name>
```

`ai:check` 只预检。`ai:prepare` 会拒绝 claims 内已有脏改动、重叠租约和重复 start。`ai:complete` 先验证再释放，不会提交、推送、发布或执行生产迁移。

## 5. 并发与扩围

- claims 重叠时后启动者停止，不得通过改短路径字符串绕过。
- 同一任务不能重复 start 重置基线，也不能被其他 agent 抢占。
- claims 租约防止文件重叠，但当前验证摘要覆盖整个 Git 工作树；基线后出现的未声明改动会阻断完成。因此同一工作树不支持多个写任务可靠并行，真正并行需使用独立 worktree。
- 活动租约的契约摘要已锁定，不能原地新增 claims。当前脚本没有 `abort`：只有原范围能独立满足真实验收时，才先完成原任务再建新契约；否则停止并报告，不得修改契约或租约绕过。
- 发现非本任务脏改动时保留原样；完成检查只追究租约后新增的越界改动。

## 6. 中断、过期与恢复

当前脚本支持过期清理；在显式恢复能力启用后支持受限 `resume`，但仍不支持 `abort/renew/recover`：

- 租约有效：继续工作并直接执行 `ai:complete`，不要重复 prepare。
- 即将过期：优先到期前完成；当前没有续租命令，不手改 lease JSON。
- 已过期且 claims 干净：确认没有新冲突后，可通过一份经批准的新契约重新开工。
- 已过期且 claims 有改动：保持现场，停止继续修改并报告；新任务也会因 claims 已脏而拒绝开工，不要提交未验证改动、伪造新基线或扩大 claims 绕过。
- 用户明确确认同一契约后，可执行 `node scripts/ai-task-flow.mjs resume --contract <path> --agent <name> --confirm RESUME:<task-id>`。`resume` 只把当前 claims 内已有路径登记为恢复前现场，保存确认串和摘要；claims 外已有并行改动同样保留为恢复前现场，恢复后新增越界改动仍由 `verify` 阻断。确认串不匹配、活动租约冲突或契约摘要变化时必须拒绝。
- 验证失败：在范围内修复后重跑；根因要求扩围时重新审批。
- agent 无法继续：报告已改文件、未完成项和验证状态，未经用户决定不宣称完成。

`resume` 只有在脚本、自测和本文同时更新后才算可用；`abort/renew/recover` 仍不可用。

## 7. 跨仓与完成定义

- 一份契约列出全部参与仓库，每仓独立 claims 和验证。
- 引擎、主题与 APay 的发布和恢复见 `docs/ai/cross-repository-development.md`。
- 契约验证不等于 Git 原子提交；最终提交元组需另行记录。

完成必须同时满足：claims 内有实际改动、没有新增越界改动、验证通过、验证后状态未变化、租约由所有者释放、交付说明完整。

Git commit、push、外部写入、发布和生产迁移需要各自授权。
