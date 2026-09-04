export interface BotDiagnosisResult {
  matched: boolean
  ruleName?: string
  botReply?: string
  suggestAutoResolved: boolean
  suggestPriority: 'low' | 'normal' | 'high' | 'urgent'
}

/**
 * 工单智能自愈诊断引擎
 * 针对高频技术上下文报错进行前置识别与人话解答，免除人工重复排查
 */
export function diagnoseTicketIssue(params: {
  category: string
  title: string
  content?: string
  context?: Record<string, any> | null
}): BotDiagnosisResult {
  const { category, title, content = '', context } = params
  const contextStr = context ? JSON.stringify(context).toLowerCase() : ''
  const searchCorpus = `${title} ${content} ${contextStr}`.toLowerCase()

  // 1. Ozon 属性必填缺失或格式不合规
  if (
    searchCorpus.includes('attribute_id') ||
    searchCorpus.includes('mandatory') ||
    searchCorpus.includes('missing attributes') ||
    searchCorpus.includes('invalid_category_parameters') ||
    searchCorpus.includes('attributes are required') ||
    searchCorpus.includes('必填属性')
  ) {
    return {
      matched: true,
      ruleName: 'ozon_missing_attributes',
      botReply: `🤖 **轻铺AI 智能排障诊断**：
系统检测到您的上架报错主要由于 **Ozon 官方类目必填属性缺失** 引起。

**建议解决步骤：**
1. 进入【上品工作台 -> 加工箱】；
2. 找到对应商品，点击【属性映射】；
3. 检查列表中标有红色星号（*）的必填属性，补全对应值（如材质、目标受众、型号等）；
4. 保存后重新执行提交发布。

*若已按要求补齐仍报错，请在下方点击「仍需人工处理」留言，管理员将深入排查。*`,
      suggestAutoResolved: true,
      suggestPriority: 'normal',
    }
  }

  // 2. Ozon 店铺凭证失效 / 401 / Unauthorized
  if (
    searchCorpus.includes('unauthorized') ||
    searchCorpus.includes('client-id') ||
    searchCorpus.includes('api-key') ||
    searchCorpus.includes('invalid api key') ||
    searchCorpus.includes('401')
  ) {
    return {
      matched: true,
      ruleName: 'store_auth_failed',
      botReply: `🤖 **轻铺AI 智能排障诊断**：
系统检测到与电商平台的通信凭证失效（**401 Unauthorized**）。

**建议解决步骤：**
1. 前往【用户中心 -> 我的店铺】；
2. 检查对应店铺的授权状态；
3. 登录 Ozon 卖家后台（Seller Center -> Settings -> API Keys），核对并重新生成包含完整权限的 Client ID 与 API Key，并更新至轻铺店铺配置中；
4. 更新后点击【测试连接】确认通信恢复正常。`,
      suggestAutoResolved: true,
      suggestPriority: 'high',
    }
  }

  // 3. 1688 滑块风控 / 反爬阻断
  if (
    searchCorpus.includes('sec.1688.com') ||
    searchCorpus.includes('punish') ||
    searchCorpus.includes('slider') ||
    searchCorpus.includes('anti_spider') ||
    searchCorpus.includes('滑块') ||
    searchCorpus.includes('验证码')
  ) {
    return {
      matched: true,
      ruleName: 'collector_1688_slider',
      botReply: `🤖 **轻铺AI 智能排障诊断**：
系统检测到本次货源采集遇到了 **1688 官方安全人机滑块验证**。

**建议解决步骤：**
1. 在当前浏览器的另一个标签页中打开 [1688.com](https://www.1688.com)；
2. 确认登录状态并手动完成弹出的滑块人机验证，确保可正常浏览商品详情；
3. 返回轻铺扩展或页面，重新发起采集。`,
      suggestAutoResolved: true,
      suggestPriority: 'normal',
    }
  }

  // 4. 定价除零或价格低于平台限制
  if (
    searchCorpus.includes('division by zero') ||
    searchCorpus.includes('price too low') ||
    searchCorpus.includes('min_price') ||
    searchCorpus.includes('价格过低') ||
    searchCorpus.includes('价格低于')
  ) {
    return {
      matched: true,
      ruleName: 'pricing_rule_error',
      botReply: `🤖 **轻铺AI 智能排障诊断**：
系统检测到发布商品的计算价格不符合平台规范或公式计算异常。

**建议解决步骤：**
1. 进入【上品工作台 -> 定价公式设置】；
2. 检查汇率（如 CNY 兑 RUB）、加价系数和运费设置，确保没有除以 0 或结果为负数的情况；
3. 注意 Ozon 等平台对单件商品有最低售价门槛（通常不建议低于 200 卢布）。`,
      suggestAutoResolved: true,
      suggestPriority: 'normal',
    }
  }

  // 5. AI 生图/抠图任务超时
  if (
    searchCorpus.includes('504') ||
    searchCorpus.includes('gateway timeout') ||
    searchCorpus.includes('cuda out of memory') ||
    searchCorpus.includes('render timeout') ||
    searchCorpus.includes('生图超时')
  ) {
    return {
      matched: true,
      ruleName: 'ai_render_timeout',
      botReply: `🤖 **轻铺AI 智能排障诊断**：
系统检测到 AI 渲染节点在执行生图或抠图时响应超时（可能是瞬时算力集群排队或高分辨率图片耗时过长）。

**处理说明：**
- 任务如果在云端最终判定失败，系统不会扣除您的可用算力点（或在失败时自动退回）；
- 建议：刷新当前创作箱，选择单个图片任务重新触发生成。
- 管理员已在后台记录该渲染异常，将持续监控节点健康度。`,
      suggestAutoResolved: false,
      suggestPriority: 'normal',
    }
  }

  // 6. 订单已成功支付 (payStatus === 'paid')
  if (context?.orderId && context?.payStatus === 'paid') {
    return {
      matched: true,
      ruleName: 'order_already_paid',
      botReply: `🤖 **轻铺AI 财务自检诊断**：
系统核验到该笔订单（单号：\`${context.orderId}\`）**已成功支付入账**。

**建议解决步骤：**
1. 请前往【用户中心 -> 账单中心】，点击顶部余额旁边的刷新按钮；
2. 如果额度仍未显示，请尝试退出登录后重新登录以刷新本地缓存；
3. 如核对后发现实际到账额度与套餐不符，请在下方留言，管理员将为您人工核对。`,
      suggestAutoResolved: true,
      suggestPriority: 'normal',
    }
  }

  // 7. 订单处于等待支付状态 (payStatus === 'pending')
  if (context?.orderId && context?.payStatus === 'pending') {
    return {
      matched: true,
      ruleName: 'order_pending_gateway',
      botReply: `🤖 **轻铺AI 财务自检诊断**：
系统检测到订单（单号：\`${context.orderId}\`）当前状态为 **等待支付回调（Pending）**。

**说明与建议：**
- 部分支付通道可能存在 1-3 分钟的网络通知延迟；
- 若您的银行卡/微信/支付宝**已实际扣款**，请在下方留言并上传扣款明细截图（含交易单号与扣款时间）；
- 管理员核实扣款流水后，将立即为您手工补单或发放对应额度。`,
      suggestAutoResolved: false,
      suggestPriority: 'high',
    }
  }

  // 8. 泛账单充值疑问但未带订单号
  if (
    category === 'billing' ||
    searchCorpus.includes('没到账') ||
    searchCorpus.includes('充值失败') ||
    searchCorpus.includes('多扣') ||
    searchCorpus.includes('未到账')
  ) {
    return {
      matched: true,
      ruleName: 'general_billing_inquiry',
      botReply: `🤖 **轻铺AI 财务自检提示**：
收到您的财务疑问。

**快速处理小贴士：**
- 您可以前往【用户中心 -> 我的订单】，在对应订单旁点击 **「申请核对」** 快速提单；
- 系统将自动调取网关流水状态并高优推送到客服工单池，大幅缩减排查时间。`,
      suggestAutoResolved: false,
      suggestPriority: 'high',
    }
  }

  return {
    matched: false,
    suggestAutoResolved: false,
    suggestPriority: 'normal',
  }
}

