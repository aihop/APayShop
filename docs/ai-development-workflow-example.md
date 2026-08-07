# AI 开发自动流程示例：Ozon 参数误拦截

> 本文只保留上手示例。字段、生命周期、并发、过期与恢复的权威规则见 `docs/ai/task-contract.md`；跨仓引擎与主题发布见 `docs/ai/cross-repository-development.md`。示例与专项文档冲突时，以专项文档和脚本行为为准。

这个示例把一次真实 Bug 修复变成可执行任务契约，目标不是替代工程判断，而是让任何 AI 都必须留下相同的证据链。

示例契约：`.ai/tasks/ozon-parameter-dictionary-guard.example.json`

## 1. 你可以这样向 AI 下达任务

```text
请按 .ai/tasks/ozon-parameter-dictionary-guard.example.json 执行。

先运行契约校验和 start dry-run，报告文件租约冲突、各仓 HEAD 与已存在的目标路径改动。
没有冲突再正式 start。只能修改已取得租约的 claims；claims 必须位于 allowedPaths 内。不得针对颜色 ID 打补丁。
实现后运行 verify；验证未全部通过不得 finish、发布 vendor、提交或推送。
删除被新投影替代的重复代码，兼容正在进行的生图任务工厂规范。
最终报告实际改动、测试结果、引擎版本、三个仓库提交和远端状态。
```

这比“帮我修一下参数报错”多明确了五件事：事实样本、可改范围、禁止方案、机器验收、Git 交付。

仓库最高开发门禁已写入 `AGENTS.md`。以后通常只需要让 AI 先参考 Demo 创建新契约，确认后执行两条快捷命令：

```bash
npm run ai:prepare -- --contract .ai/tasks/<task-id>.json --agent coder-ai
# AI 在 claims 范围内实现任务
npm run ai:complete -- --contract .ai/tasks/<task-id>.json --agent coder-ai
```

最小通用样例是 `.ai/tasks/hello-ai-task.demo.json`。可直接对 AI 说：

```text
参考 .ai/tasks/hello-ai-task.demo.json，先为我的需求创建正式任务契约，不要修改业务代码。
向我摘要范围和验收标准；我确认后按 AGENTS.md 执行 ai:prepare、开发和 ai:complete。
```

## 2. 标准执行顺序

```bash
# 只校验契约结构，不写运行状态
node scripts/ai-task.mjs validate \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json

# 开工预演：显示三个仓库的 HEAD、分支和租约范围
node scripts/ai-task.mjs start \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json \
  --agent coder-ai-example \
  --dry-run

# 无冲突后正式取得文件租约
node scripts/ai-task.mjs start \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json \
  --agent coder-ai-example

# 查看当前所有任务占用
node scripts/ai-task.mjs status

# 开发中先查看按 diff 将执行哪些检查
node scripts/ai-task.mjs verify \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json \
  --dry-run --all

# 完成代码后执行命中的真实验证
node scripts/ai-task.mjs verify \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json

# 只有成功验证报告存在时才能释放租约
node scripts/ai-task.mjs finish \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json \
  --agent coder-ai-example
```

运行态保存在 `.tmp/ai-tasks/`，不会提交到 Git；任务契约本身进入版本库，方便复盘和复制。

## 3. 这个 MVP 已经自动拦什么

- 契约字段缺失、仓库路径错误、claim 超出 `allowedPaths`。
- 两个有效任务声明了重叠文件或目录。
- 用不同仓库别名声明同一目录，或重复 `start` 重置开工基线。
- 开工时目标文件已有未提交改动，例如另一个 AI 正在重铺 vendor。
- 开工后产生契约范围外的新改动。
- 修改虽在 `allowedPaths`、但未被当前任务 `claims` 租用的文件。
- `start` 后替换同 ID 契约、扩大白名单或修改验证命令。
- 验证命令失败时生成失败报告并禁止 `finish`。
- 没有成功报告、报告后代码变化或租约过期时执行 `finish`。
- 非租约持有人释放任务。

## 4. 它暂时不自动做什么

- 不自动创建三个仓库的 worktree。
- 不自动提交、发布 vendor 或推送；这些动作风险更高，下一阶段再做跨仓 release 编排。
- 无法识别未使用本流程的另一个 AI 的“意图”；但只要对方已修改目标文件，开工脏路径检查仍会阻断。

实际推广时，先要求所有 AI 在改共享出口、vendor、`package.json` 前执行 `start`。等团队稳定使用后，再把任务契约校验和 `verify` 接入 CI。
