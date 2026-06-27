/**
 * 统一时间格式化:后端一律返回 UTC 绝对时间(RFC3339,带 Z),
 * 前端按 settings 里的 `timezone`(默认 Asia/Shanghai)+ 当前语言渲染。
 *
 * 用法(在组件 <script setup> 中):
 *   const { formatDateTime, formatDate } = useFormatTime()
 *   {{ formatDateTime(row.createdAt) }}   // 2026/06/27 14:30:00
 *   {{ formatDate(order.paidAt) }}        // 2026/06/27
 */
export const useFormatTime = () => {
  const { getSetting } = useSettings()
  const nuxtApp = useNuxtApp()

  const getTimezone = () => getSetting('timezone', 'Asia/Shanghai') || 'Asia/Shanghai'
  const getLocale = () => (unref((nuxtApp.$i18n as any)?.locale) === 'en' ? 'en-US' : 'zh-CN')

  const fmt = (value: any, opts: Intl.DateTimeFormatOptions): string => {
    if (value === null || value === undefined || value === '') return '-'
    const d = value instanceof Date ? value : new Date(value)
    if (isNaN(d.getTime())) return '-'
    try {
      return new Intl.DateTimeFormat(getLocale(), { timeZone: getTimezone(), ...opts }).format(d)
    } catch {
      // 非法时区兜底:用 UTC 渲染,避免抛错
      return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', ...opts }).format(d)
    }
  }

  const formatDateTime = (value: any) =>
    fmt(value, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })

  const formatDate = (value: any) =>
    fmt(value, { year: 'numeric', month: '2-digit', day: '2-digit' })

  // 通用:自定义 Intl 选项,仍按设置时区渲染
  const format = (value: any, opts: Intl.DateTimeFormatOptions) => fmt(value, opts)

  return { formatDateTime, formatDate, format, getTimezone }
}
