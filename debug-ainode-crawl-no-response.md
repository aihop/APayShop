# [OPEN] ainode-crawl-no-response

## 背景
- 症状：Qingpu 1688 直抓调用 ainode `/ai/crawl` 时“没反应”。
- 期望：能够明确看到请求是否发出、命中了哪个 `baseUrl`、是否读到用户配置中的 API Key、请求耗时、是否发生重试以及最终失败原因。

## 初始假设
1. `generalModelApiKey` 没有正确从 `qingpu_settings` 读到，导致请求根本没发出。
2. `generalModelBaseUrl` 配置错误，实际请求没打到 `https://api.ainode.run/ai/crawl`。
3. 请求已发出，但上游长时间无响应，卡在 `AbortSignal.timeout(20000)` 与重试退避上。
4. 上游已返回响应，但返回体不是预期 JSON，导致被收敛成 `ainode invalid json` 或 `ainode empty data`。
5. provider 调用链没有把 `userId/sourceProductId` 正确传到抓取层，导致配置或 URL 拼接异常。

## 计划
1. 在不改业务逻辑的前提下添加调试日志埋点。
2. 复现一次抓取，采集运行时证据。
3. 根据证据定位根因，再决定是否需要修复。

## 进展记录
- 已创建调试会话文件，等待加入埋点。
- 已启动 Debug Server：`http://127.0.0.1:7777`。
- 已在 `app/themes/qingpu/server/listing/ainode-crawl.ts` 加入只读型埋点，覆盖配置解析、请求开始、响应状态、JSON 解析、空数据、重试与成功/失败分支。
- 下一步：用户复现一次抓取，再读取 `.dbg/trae-debug-log-ainode-crawl-no-response.ndjson` 分析证据。
- 已读取运行时日志，确认请求确实发出了 3 次，但实际命中的地址是 `https://api.ainode.run/ai/crawl`，并非用户手工 `curl` 使用的 `https://api.ainode.run/ai/crawl`。
- 3 次请求都在约 `10.5s` 内以 `TypeError: fetch failed` 结束，说明错误发生在拿到 HTTP 响应之前（网络/DNS/TLS/网关不可达），而不是应用层返回 4xx/5xx 或 JSON 解析失败。

## 证据结论
- **假设 A（没读到 API Key）**：否。日志显示 `hasApiKey: true`。
- **假设 B（baseUrl 配错）**：是。日志显示 `baseUrl = https://api.ainode.run`，与手工成功示例 `https://api.ainode.run` 不一致。
- **假设 C（请求卡在上游超时/重试）**：部分成立。确实发生了重试，但根因不是业务预热，而是 `fetch failed` 的传输层失败。
- **假设 D（返回体非法）**：否。没有任何一次拿到 HTTP 响应头或 JSON。
- **假设 E（透传异常）**：否。日志中的 `userId/numIid/url` 都正确。
