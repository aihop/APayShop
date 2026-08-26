# `.ai/` 目录规范

本目录是 APay 及其参与仓库的 AI 任务契约入口，只保存需要版本化、可审查的任务定义。完整生命周期和字段规则以 `docs/ai/task-contract.md` 为唯一事实源，命令行为以 `scripts/ai-task.mjs` 与 `scripts/ai-task-flow.mjs` 为准。

## 目录所有权

| 路径 | 用途 | 是否提交 |
|---|---|---|
| `.ai/tasks/*.json` | 独立任务契约：范围、claims、验收与验证 | 是 |
| `.ai/README.md` | 目录入口与维护边界 | 是 |
| `.tmp/ai-tasks/leases/*.json` | 本机有效文件租约与开工基线 | 否 |
| `.tmp/ai-tasks/reports/*.json` | 本机验证报告与仓库状态摘要 | 否 |

`.tmp/ai-tasks` 是脚本管理的运行态，不属于 `.ai/` 的版本化内容。禁止手改、提交、复制租约或报告来伪造续租、恢复、验证结果或新基线。

当前验证以每个仓库的完整 HEAD 与工作区状态生成摘要，并会拒绝租约基线之后出现的未声明改动。因此，同一 Git 工作树中的两个写任务即使 claims 不重叠，也可能互相阻断完成；需要真正并行时使用独立 worktree，或串行完成后再启动下一任务。

## 标准流程

1. 在 `.ai/tasks/<task-id>.json` 建独立契约，声明所有参与仓库、`allowedPaths`、精确 `claims`、验收标准和验证命令。
2. 用户确认目标和范围后，从 APay 根执行：

   ```bash
   npm run ai:prepare -- --contract .ai/tasks/<task-id>.json --agent <name>
   ```

3. 只修改 claims；发现需要扩围、租约冲突或其他会话改动时停止，不得改契约摘要、手改运行态，或用更宽路径和新任务绕过重叠租约。
4. 完成后执行：

   ```bash
   npm run ai:complete -- --contract .ai/tasks/<task-id>.json --agent <name>
   ```

5. 只有验证报告与当前仓库状态一致，且租约由所有者释放，AI 任务流程才完成。commit、push、发布和生产迁移仍需各自授权。

纯只读分析不建契约；代码任务、高风险执行文档、支付、价格、库存、数据库、鉴权、发布和跨仓 vendor 必须建契约。普通说明文档是否需要契约按 `docs/ai/task-contract.md` 的适用范围判断。

## 中断与异常

- 租约有效：继续原任务，禁止重复 `ai:prepare` 重置基线。
- 需要扩围：当前脚本不支持活动租约原地扩围或 `abort`。只有原范围本身能形成独立、真实、可验收结果时，才先 `ai:complete`，再新建契约并重新确认；否则保留现场、停止并报告，由用户决定如何处置。
- 租约过期：claims 干净时可在确认无冲突后建立新契约；claims 已修改时必须保留现场并报告。用户明确确认恢复同一任务后，可执行 `node scripts/ai-task-flow.mjs resume --contract .ai/tasks/<task-id>.json --agent <name> --confirm RESUME:<task-id>`；该命令只登记 claims 内已有改动为恢复前现场，保留 claims 外并行改动，不得扩大契约范围或手改运行态。
- 验证失败：只在现有 claims 内修复并重跑；根因超出范围时重新审批。
- 并行提交或工作区变化使验证失效：保留他人改动，报告冲突并协调，不回退、不覆盖、不伪造通过。

## 文档路由

- 契约字段、审批、claims、验证、过期与完成：`docs/ai/task-contract.md`
- `qingpu-ai`、Qingpu 主题与 APay 的所有权和发布：`docs/ai/cross-repository-development.md`
- 可执行示例：`docs/ai-development-workflow-example.md`
- 当前任务的工程与业务专项约束：根 `AGENTS.md` 文档地图

新增目录层级、运行态类型或生命周期能力时，先更新脚本与验证，再同步上述唯一事实源和本入口；不要在单个任务契约中发明长期规则。
