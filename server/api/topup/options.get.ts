import { getTopupRules } from '../../utils/topup'

/**
 * 快捷充值可选项:币种、区间、快捷档位与折算汇率。
 * 前端据此渲染输入框并预览到账额度;真正的校验与折算在下单接口重做一遍
 * (这里返回的一切都只是展示,不作为信任来源)。
 */
export default defineEventHandler(async () => {
  const rules = await getTopupRules()

  return {
    code: 0,
    data: {
      enabled: rules.enabled,
      accountingCurrency: rules.accountingCurrency,
      currencies: Object.entries(rules.options).map(([currency, option]) => ({
        currency,
        min: option.min,
        max: option.max,
        presets: option.presets,
        rate: option.rate,
      })),
    },
  }
})
