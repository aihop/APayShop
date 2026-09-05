# `.ai/` 目录规范

本目录是 APay 及其参与仓库的 AI 任务契约入口，只保存需要版本化、可审查的任务定义。字段、生命周期和范围规则以 `docs/ai/task-contract.md` 为唯一事实源，命令行为以 `scripts/ai-task.mjs` 与 `scripts/ai-task-flow.mjs` 为准。

## 目录所有权

| 路径 | 用途 | 是否提交 |
|---|---|---|
| `.ai/tasks/*.json` | 独立任务契约：claims 与验证，按需补目标与验收 | 是 |
| `.ai/README.md` | 目录入口与维护边界 | 是 |
| `.tmp/ai-tasks/leases/*.json` | 当前 worktree 的文件租约与开工基线 | 否 |
| `.tmp/ai-tasks/reports/*.json` | 当前 worktree 的验证报告 | 否 |

`.tmp/ai-tasks` 是脚本管理的运行态，按 worktree 隔离。禁止手改租约或报告来伪造续租、恢复、验证结果或新基线。

## 标准流程

1. 参考 `.ai/tasks/hello-ai-task.demo.json` 建 `.ai/tasks/<task-id>.json`：必填 `id`、`title`、各仓 `claims` 和 `verification`；预计会追加路径就先声明 `allowedPaths` 作为预算。
2. 用户确认后从 APay 根执行：

   ```bash
   npm run ai:prepare -- --contract .ai/tasks/<task-id>.json --agent <name>
   ```

3. 只修改 claims。需要新路径：补进契约 `claims`，执行 `node scripts/ai-task-flow.mjs extend --contract <path> --agent <name>`；超出 `allowedPaths` 预算时先征得用户确认再附 `--confirm EXTEND:<task-id>`。快到期就 `renew`，做不下去就 `abort`。
4. 完成后执行：

   ```bash
   npm run ai:complete -- --contract .ai/tasks/<task-id>.json --agent <name>
   ```

5. 验证通过并释放租约后，AI 任务流程完成。commit、push、发布和生产迁移仍需各自授权。

纯只读分析不建契约；代码任务、高风险执行文档、支付、价格、库存、数据库、鉴权、发布和跨仓 vendor 必须建契约。

## 越界与异常

- verify 报告「租约外的工作区改动」：属于本任务就 `extend`；属于其他会话就让对方取得租约或改用独立 worktree。其他活动租约的 claims、别人已提交的改动和 `.DS_Store` 不会被算作越界。
- 租约过期且 claims 已改：用户确认后执行 `node scripts/ai-task-flow.mjs resume --contract <path> --agent <name> --confirm RESUME:<task-id>`。
- 验证失败：在 claims 内修复并重跑；根因超出 claims 就 `extend`。

## 文档路由

- 契约字段、命令、范围规则、过期与完成：`docs/ai/task-contract.md`
- `qingpu-ai`、Qingpu 主题与 APay 的所有权和发布：`docs/ai/cross-repository-development.md`
- 可执行示例：`docs/ai-development-workflow-example.md`
- 当前任务的工程与业务专项约束：根 `AGENTS.md` 文档地图

新增运行态类型或生命周期能力时，先更新脚本与自测，再同步上述事实源和本入口；不要在单个任务契约中发明长期规则。
