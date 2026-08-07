# Qingpu 跨仓开发与发布契约

本文是 `qingpu-ai`、Qingpu 网页主题和 APay 主仓之间所有权、共享引擎和发布顺序的唯一事实源。

## 1. 仓库边界

| 仓库 | 默认路径 | 所有权 |
|---|---|---|
| `qingpu-ai` | `../qingpu-ai` | 扩展、Electron、领域模型、三端共享 engine 源码与测试 |
| `apay-qingpu` | `app/themes/qingpu` | Qingpu 网页 UI、主题 API、私有 PG、任务执行与 engine vendor |
| `apay` | `.` | Nuxt 宿主、核心支付/订单/认证、主题装配与部署入口 |

Qingpu 主题目前仍是 APay 工作树内的**独立 Git 仓库**。APay 已不再用 gitlink 固定它，因此 APay 单一提交不能证明主题版本；发布记录必须显式包含三个仓库中实际参与发布的提交。

在正式流水线能从锁文件还原主题前，不得宣称“只 checkout APay 即可完整复现 Qingpu 产品”。

## 2. 共享口径

- 三端共用的状态、草稿就绪度、SKU、定价、图片任务和发布校验只在 `qingpu-ai/src/engine/` 定义。
- 主题通过 `server/vendor/qingpu-engine/` 消费产物，不复制共享口径。
- vendor 只允许 `npm run engine:release -- --version x.y.z` 写入。
- `version.json` 的 `version/sourceCommit/builtAt` 是防漂移锚点，同一版本不得对应两个源提交。

## 3. 标准发布顺序

```text
提交 qingpu-ai 源码
-> engine:release 写主题 vendor
-> 验证 sourceCommit 与主题合同
-> 提交/push 主题仓
-> 宿主有改动时提交/push APay
-> 记录提交元组
```

1. `qingpu-ai` 引擎相关工作树干净，按风险运行类型、测试和 bundle 守卫。
2. 先提交 `qingpu-ai`，确保 HEAD 包含产物源码。
3. 用严格递增版本执行 `engine:release`。
4. 在主题仓确认 `version.json.sourceCommit` 等于源码提交，vendor 只有生成产物变化。
5. 运行主题专项守卫、Listing 合同和 APay 构建；支付/发布默认 dry-run。
6. 只提交主题仓本任务文件并 push；APay 父仓 commit 不能代替主题提交。
7. 只有宿主、文档、构建或装配变化时才提交 APay。
8. 发布说明记录 `{ qingpuAiCommit, engineVersion, themeCommit, apayCommit? }`。

## 4. 跨仓 AI 任务

- 使用 APay `.ai/tasks/*.json` 作为入口，一份契约列全参与仓库。
- engine 源与测试属于 `qingpu-ai`，vendor 与主题实现属于 `qingpu-theme`，宿主文件属于 `apay`。
- 不默认租整个主题或整个 `src/`；只租闭环需要的文件。
- 源码与 vendor 属于同一结果时，验收同时校验行为、版本锚点和主题合同。
- AI 契约解决文件并发和验证，不解决三个 Git 仓库的原子提交。

## 5. 失败与恢复

- engine 构建失败：停止，主题 vendor 不应变化。
- vendor 已写入但主题验证失败：保留现场修复或由用户决定回退，不手改产物。
- 主题已提交而 APay 失败：修复宿主后记录新提交元组，不重写 engine 版本。
- `sourceCommit` 与源码不一致：废弃该版本并发布更高版本，禁止复用旧号。
- 任一仓有其他会话改动：只提交本任务文件；无法隔离时停止协调。

## 6. 文档所有权

- 本文：跨仓所有权、版本锚点、发布顺序和恢复。
- `qingpu-ai/AGENTS.md`：引擎出口、领域分层与扩展执行约束。
- `app/themes/qingpu/AGENTS.md`：主题 SQL、依赖方向与验证。
- APay `AGENTS.md` 和 `docs/engineering-constraints.md`：宿主、支付、数据库与主题安全边界。

边界变化先改本文，再同步各仓短摘要和脚本；禁止三处分别演化。
