import { loadActiveThemeEventRules } from '../../../utils/themeEvents'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const isZh = locale.startsWith('zh')

  const [systemActions, registeredThemeRules] = await Promise.all([
    [
      {
        key: 'grant_reward',
        type: 'system',
        label: isZh ? '发放奖励' : 'Grant Reward',
        description: isZh ? '向用户发放积分、赠送余额或现金' : 'Credit points, grant balance or cash to user',
        supportedEvents: ['user.registered', 'order.paid'],
      },
      {
        key: 'send_webhook',
        type: 'system',
        label: isZh ? '外发 Webhook' : 'Send Webhook',
        description: isZh ? '向指定的自定义 URL 推送包含事件数据的 HTTP POST 请求' : 'Dispatch HTTP POST webhook with event payload',
        supportedEvents: ['user.registered', 'order.paid'],
      },
    ],
    loadActiveThemeEventRules(),
  ])

  const themeActions = registeredThemeRules.map(action => ({
    key: action.key,
    type: 'theme',
    theme: action.theme,
    label: action.label,
    description: action.description,
    supportedEvents: [action.event],
  }))

  return {
    code: 0,
    data: {
      systemActions,
      themeActions,
    },
  }
})
