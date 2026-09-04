# 任务:在 APay  中接入 ainode 的订阅三池计费(发送订阅生命周期 Webhook)

## 背景
- APay  是支付/电商平台(Nuxt 3 + Nitro server,TypeScript,代码在 /Users/hugh/code/hoxi/APay ,服务端在 server/)。
- ainode 是 AI 网关计费系统,它持有用户的余额「三池」:
  1. 订阅实付 sub(用户为订阅实际付的钱)
  2. 订阅赠送 grant(套餐附赠的额度)
  3. 充值余额 cash(永久)
- 消费顺序:sub → grant → cash。
- 取消/过期时:grant 清零,sub 剩余转入 cash(不没收)。

## 职责边界(重要,不要越界)
- **APay  只负责「钱」**:订阅定价、升级/降级的 proration(补差价/按比例)、实际收款金额、各套餐的赠送额、周期到期时间。算完后,把**最终结果**通过 Webhook 通知 ainode。
- **APay  不负责余额池的加减**:不要去算 sub/grant/cash 怎么变,那是 ainode 的事。APay  只把「本周期实付多少、赠送多少、到期时间、套餐等级」发过去,ainode 自己做状态机。

## 你要实现的功能
在「订阅/续费/升级/降级/取消」的业务流程**成功并落库之后**,可靠地向 ainode 发送对应的 Webhook 事件。

## Webhook 调用契约(必须严格遵守)

- 方法:POST
- URL:`${AINODE_BASE_URL}/api/webhooks/events`(从环境变量读 `AINODE_BASE_URL`,例如 https://api.ainode.run;**服务端调用,走内网地址更好**)
- Header:
  - `Content-Type: application/json`
  - `Authorization: Bearer ${AINODE_INTERNAL_TOKEN}`(从环境变量读,**机密**,勿硬编码/勿入库)
- 金额单位:**元(decimal,浮点)**,例如 100.00、700.00(ainode 内部自行放大存储,APay  传元即可)。

### 事件 1:订阅生效 / 续费 / 升级 / 降级(统一用这一个)
```json
{
  "event": "subscription.apply",
  "timestamp": "<ISO8601 当前时间>",
  "data": {
    "eventId": "sub:apply:<subscriptionId>:<cycleSeq>",
    "userId": <ainode 用户ID, int>,
    "paidAmount": 100.00,
    "grantAmount": 700.00,
    "expiresAt": "<本周期到期 ISO8601>",
    "tier": <套餐等级 int>,
    "sourceId": "<订单ID 或 订阅ID>",
    "remark": "<可读备注, 如 'Pro 月付续费' / '升级到 Pro Max'>"
  }
}
```
说明:
- 无论首次订阅、续费、升级、降级,都发这一个事件。把「**换/续套餐后本周期的最终值**」填进去:
  - `paidAmount` = 本周期用户实付(升级补差价的话,填 APay  计算后的本周期实付等效金额);
  - `grantAmount` = 本周期套餐赠送额;
  - `expiresAt` = 本周期到期时间。
- ainode 收到后会:把旧订阅实付剩余转入 cash、旧赠送清零,然后写入新的 paid/grant/到期。**APay  不用管旧额度怎么处理。**

### 事件 2:取消订阅
```json
{
  "event": "subscription.cancel",
  "timestamp": "<ISO8601>",
  "data": {
    "eventId": "sub:cancel:<subscriptionId>:<触发时间或单调序号>",
    "userId": <int>,
    "sourceId": "<订阅ID>",
    "remark": "<如 '用户主动取消'>"
  }
}
```
说明:ainode 收到后会把订阅赠送清零、订阅实付剩余转入 cash。
> 「自然过期未续费」可以不发事件(ainode 有每日兜底任务按到期时间处理);如果你们希望即时生效,也可在过期时发一条 `subscription.cancel`。

## 幂等(必须)
- `eventId` 对同一逻辑事件必须**稳定且唯一**(ainode 以此去重,重复发送不会重复入账)。
- 续费每期用不同的 `cycleSeq`(如周期序号/账期ID),保证每期是一条新事件;同一期重发用相同 eventId。
- 升级/降级各自生成独立 eventId(如带上变更动作和时间/版本)。

## 可靠性(必须)
- Webhook 必须在**本地业务事务提交后**发送(先保证 APay  自己的订单/订阅状态已落库)。
- 发送要有**重试**(指数退避),直到 ainode 返回 2xx;多次失败要落「待重发」表 + 告警,**不能静默丢失**(这关系到用户余额)。
- ainode 返回示例:成功 `{"alreadyProcessed":false,...}` 或 `{"alreadyProcessed":true,...}`(幂等命中,也算成功,不要再重发);4xx 是请求错误(不要无脑重试,记录排查);5xx/网络错误才重试。

## 套餐配置要求
- 每个订阅套餐(plan)在 APay  配置里需要能取到:**月付价(=paidAmount)**、**赠送额(=grantAmount)**、**周期长度**(用于算 expiresAt)、**tier 等级**。
- 升级/降级的差价与本期实付的计算逻辑由 APay  决定(proration 规则你们定),最终把结果填进 `subscription.apply`。

## 代码组织建议
- **不新建独立模块**，只增强已有的 `server/utils/eventBus.ts`：
  - 导出 `sendHttpWebhook(url, body, options?)` — 底层发送函数，带**指数退避重试**（3次，最大间隔10s）、4xx 不重试、5xx/网络错误才重试。
- 调用方（`fulfillment.ts`、`admin/subscriptions/[id].delete.ts`）直接拿 `sendHttpWebhook` 拼 ainode payload 发送，不封装中间层。
- ainode 的 baseUrl、internalToken 直接从环境变量读取（`process.env.AINODE_BASE_URL` / `process.env.AINODE_INTERNAL_TOKEN`，不写入 runtimeConfig 避免暴露）。
- 调用时机：
  - `subscription.apply` 在 `server/utils/fulfillment.ts` 的 `subscription` case 履约完成后调用。
  - `subscription.cancel` 在管理员取消订阅的 API 端点中调用（`server/api/admin/subscriptions/[id].delete.ts`）。

## 验收标准
1. 首次订阅成功 → ainode 收到 `subscription.apply`,用户三池正确(sub=paidAmount、grant=grantAmount)。
2. 续费 → 旧实付剩余进 cash、赠送清零、发放新一期(由 ainode 处理,APay  只发事件)。
3. 升级/降级 → 同样只发一条 `subscription.apply`(带换套餐后的最终值)。
4. 取消 → 发 `subscription.cancel`,ainode 赠送清零、实付剩余进 cash。
5. 重复发送同一 `eventId` 不产生重复效果(幂等)。
6. ainode 不可达/5xx 时有重试与兜底,不丢事件。
7. token、base url 不硬编码,走环境变量。

## 约束
- 不要在 APay  侧计算或修改 ainode 的余额池;只发送最终金额。
- 不要把 `AINODE_INTERNAL_TOKEN` 写进代码或提交进仓库。
- 金额一律用元(decimal)。