# AI 开发自动流程示例：Ozon 参数误拦截

> 本文只保留上手示例。字段、生命周期、范围规则、过期与恢复的权威规则见 `docs/ai/task-contract.md`；跨仓引擎与主题发布见 `docs/ai/cross-repository-development.md`。示例与专项文档冲突时，以专项文档和脚本行为为准。

这个示例把一次真实 Bug 修复变成可执行任务契约，目标不是替代工程判断，而是让任何 AI 都必须留下相同的证据链。

示例契约：`.ai/tasks/ozon-parameter-dictionary-guard.example.json`

## 1. 你可以这样向 AI 下达任务

```text
请按 .ai/tasks/ozon-parameter-dictionary-guard.example.json 执行。

先运行 ai:check 预检，报告文件租约冲突、各仓 HEAD 与已存在的目标路径改动。
没有冲突再 ai:prepare。只能修改已取得租约的 claims；需要别的文件先补进契约再 extend。不得针对颜色 ID 打补丁。
实现后 ai:complete；验证未全部通过不得发布 vendor、提交或推送。
删除被新投影替代的重复代码，兼容正在进行的生图任务工厂规范。
最终报告实际改动、测试结果、引擎版本、三个仓库提交和远端状态。
```

这比"帮我修一下参数报错"多明确了五件事：事实样本、可改范围、禁止方案、机器验收、Git 交付。

仓库最高开发门禁已写入 `AGENTS.md`。以后通常只需要让 AI 先参考 Demo 创建新契约，确认后执行两条快捷命令：

```bash
npm run ai:prepare -- --contract .ai/tasks/<task-id>.json --agent coder-ai
# AI 在 claims 范围内实现任务；需要新文件先补进契约再 extend
npm run ai:complete -- --contract .ai/tasks/<task-id>.json --agent coder-ai
```

最小通用样例是 `.ai/tasks/hello-ai-task.demo.json`。可直接对 AI 说：

```text
参考 .ai/tasks/hello-ai-task.demo.json，先为我的需求创建正式任务契约，不要修改业务代码。
向我摘要 claims 和验证命令；我确认后按 AGENTS.md 执行 ai:prepare、开发和 ai:complete。
```

## 2. 标准执行顺序

```bash
# 只校验契约结构并列出验证清单，不写运行状态
npm run ai:check -- --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json

# 取得文件租约（默认 480 分钟）
npm run ai:prepare -- --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json --agent coder-ai-example

# 查看当前所有任务占用与最近报告
node scripts/ai-task.mjs status --reports 5

# 开发中发现需要新文件：先写进契约 claims，再扩围
node scripts/ai-task-flow.mjs extend \
  --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json \
  --agent coder-ai-example
# 超出 allowedPaths 预算时，先征得用户确认，再附 --confirm EXTEND:<task-id>

# 快到期时续租；做不下去时放弃
node scripts/ai-task-flow.mjs renew --contract <path> --agent coder-ai-example
node scripts/ai-task-flow.mjs abort --contract <path> --agent coder-ai-example

# 完成代码后：执行命中的验证并释放租约
npm run ai:complete -- --contract .ai/tasks/ozon-parameter-dictionary-guard.example.json --agent coder-ai-example
```

单步命令（`validate / start / verify / finish`）见 `node scripts/ai-task.mjs help`。运行态保存在当前 worktree 的 `.tmp/ai-tasks/`，不进入 Git；任务契约本身进入版本库，方便复盘和复制。

## 3. 它自动拦什么

- 契约字段缺失、仓库路径错误、claim 超出已声明的 `allowedPaths`。
- 同一 worktree 里两个有效任务声明了重叠文件或目录。
- 用不同仓库别名声明同一目录，或重复 `start` 重置开工基线。
- 开工时目标文件已有未提交改动，例如另一个 AI 正在重铺 vendor。
- 开工后工作区出现 claims 之外的新增改动。
- `start` 后替换同 ID 契约、修改验证命令而不走 `extend`。
- 验证命令失败时生成失败报告并禁止 `finish`。
- 没有成功报告、验证后 claims 内文件又变化、或租约过期时执行 `finish`。
- 非租约持有人扩围、续租、放弃或释放任务。

## 4. 它故意不拦什么

- 其他活动租约 claims 里的改动、别人已经提交进 HEAD 的改动、`.DS_Store` 这类系统元数据：这些不是本任务的责任。
- 不同 worktree 之间的并行：租约按 worktree 隔离，冲突在合并时处理。
- 三个仓库的原子提交、vendor 发布和推送：这些动作风险更高，需要各自授权。
