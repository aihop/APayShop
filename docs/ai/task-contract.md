# APay AI 任务契约

本文是 `.ai/tasks/*.json`、文件租约和验证报告的流程事实源。`.ai/` 目录布局与维护规则见 `.ai/README.md`，命令行为以 `scripts/ai-task.mjs` 与 `scripts/ai-task-flow.mjs` 为准。

## 1. 适用范围

所有代码改动默认先建独立契约。发布、支付、价格、库存、数据库、鉴权、跨仓 vendor 和并发任务不得豁免。

纯分析、只读审计和不修改仓库的验证不建契约。只改错字或单页说明可省略；修改执行协议、架构事实源或跨仓流程时必须建契约。

## 2. 生命周期

```text
draft -> user-approved -> leased -> verifying -> verified -> finished
                    \-> expired / blocked
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
- 开工后需要新增文件时停止修改；先安全结束当前租约，再改契约并重新审批。
- 发现非本任务脏改动时保留原样；完成检查只追究租约后新增的越界改动。

## 6. 中断、过期与恢复

当前脚本支持过期清理，但**不支持带脏 claims 的自动 renew/resume/recover**：

- 租约有效：继续工作并直接执行 `ai:complete`，不要重复 prepare。
- 即将过期：优先到期前完成；当前没有续租命令，不手改 lease JSON。
- 已过期且 claims 有改动：保持现场，停止继续修改并报告；不要伪造新基线或扩大 claims 绕过。
- 验证失败：在范围内修复后重跑；根因要求扩围时重新审批。
- agent 无法继续：报告已改文件、未完成项和验证状态，未经用户决定不宣称完成。

`renew/resume/recover` 只有在脚本、自测和本文同时更新后才算可用。

## 7. 跨仓与完成定义

- 一份契约列出全部参与仓库，每仓独立 claims 和验证。
- 引擎、主题与 APay 的发布和恢复见 `docs/ai/cross-repository-development.md`。
- 契约验证不等于 Git 原子提交；最终提交元组需另行记录。

完成必须同时满足：claims 内有实际改动、没有新增越界改动、验证通过、验证后状态未变化、租约由所有者释放、交付说明完整。

Git commit、push、外部写入、发布和生产迁移需要各自授权。
