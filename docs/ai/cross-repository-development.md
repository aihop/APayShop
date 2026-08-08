# Qingpu 跨仓开发与发布契约

本文是 `qingpu-ai`、Qingpu 网页主题和 APay 主仓之间所有权、共享引擎和发布顺序的唯一事实源。

## 1. 仓库边界

| 仓库 | 默认路径 | 所有权 |
|---|---|---|
| `qingpu-ai` | `../qingpu-ai` | 扩展、Electron、领域模型、三端共享 engine 源码与测试 |
| `apay-qingpu` | `app/themes/qingpu` | Qingpu 网页 UI、主题 API、私有 PG、任务执行与 engine vendor |
| `apay` | `.` | Nuxt 宿主、核心支付/订单/认证、主题装配与部署入口 |

Qingpu 主题是 APay 工作树内的**独立 Git 仓库**，同时由 APay index 中的 `app/themes/qingpu` gitlink（mode `160000`）固定目标提交。APay 提交因此能标识应使用的 `themeCommit`，但当前仓库没有 `.gitmodules`，不包含主题远端 URL 或自动初始化方式；只 checkout APay 仍不能单独拉取并还原主题源码。

完整复现需要已知主题仓来源，并检出 APay gitlink 指向的提交。发布记录仍显式保存全部提交元组，不能只写 APay 提交或只写主题提交。

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
-> 推进 APay gitlink 并提交/push APay
-> 记录提交元组
```

1. `qingpu-ai` 引擎相关工作树干净，按风险运行类型、测试和 bundle 守卫。
2. 先提交 `qingpu-ai`，确保 HEAD 包含产物源码。
3. 用严格递增版本执行 `engine:release`。
4. 在主题仓确认 `version.json.sourceCommit` 等于源码提交，vendor 只有生成产物变化。
5. 运行主题专项守卫、Listing 合同和 APay 构建；支付/发布默认 dry-run。
6. 只提交主题仓本任务文件并 push；APay gitlink 只记录提交指针，不能代替主题提交。
7. 在 APay 更新 `app/themes/qingpu` 指针并提交/push；主题提交变化时这一步不可省略，宿主代码无变化也一样。
8. 发布说明记录 `{ qingpuAiCommit, engineVersion, themeCommit, apayCommit }`，并确认 APay gitlink 等于 `themeCommit`。

## 4. 跨仓 AI 任务

- 使用 APay `.ai/tasks/*.json` 作为入口，一份契约列全参与仓库。
- engine 源与测试属于 `qingpu-ai`，vendor 与主题实现属于 `qingpu-theme`，宿主文件属于 `apay`。
- 若任务会在 `ai:complete` 前提交主题或推进主题指针，APay 仓必须同时声明并租用 `app/themes/qingpu`；否则主题 HEAD 变化会表现为 APay 的未声明 gitlink 改动。
- 不默认租整个主题或整个 `src/`；只租闭环需要的文件。
- 源码与 vendor 属于同一结果时，验收同时校验行为、版本锚点和主题合同。
- AI 契约解决文件并发和验证，不解决三个 Git 仓库的原子提交。

## 5. 失败与恢复

- engine 构建失败：停止，主题 vendor 不应变化。
- vendor 已写入但主题验证失败：保留现场修复或由用户决定回退，不手改产物。
- 主题已提交而 APay gitlink 未推进：保留已发布主题提交，修复 APay 指针或宿主后再形成 `apayCommit`，不重写 engine 版本。
- `sourceCommit` 与源码不一致：废弃该版本并发布更高版本，禁止复用旧号。
- 任一仓有其他会话改动：只提交本任务文件；无法隔离时停止协调。

## 6. 文档所有权

- 本文：跨仓所有权、版本锚点、发布顺序和恢复。
- `qingpu-ai/AGENTS.md`：引擎出口、领域分层与扩展执行约束。
- `app/themes/qingpu/AGENTS.md`：主题 SQL、依赖方向与验证。
- APay `AGENTS.md` 和 `docs/engineering-constraints.md`：宿主、支付、数据库与主题安全边界。

边界变化先改本文，再同步各仓短摘要和脚本；禁止三处分别演化。
