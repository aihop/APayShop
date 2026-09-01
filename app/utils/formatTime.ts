 
export function formatRelativeTime(dateInput: string | number | Date, t: any, tz?: string): string {
  if (!dateInput) return ''
  
  const date = new Date(dateInput)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 0 || isNaN(date.getTime())) {
    return date.toLocaleDateString()
  }

  const resolve = (key: string, fallbackKey: string) => {
    const res = typeof t === 'function' ? t(key) : ''
    if (res && res !== key) return res
    const fb = typeof t === 'function' ? t(fallbackKey) : ''
    return fb || res || key
  }

  if (diffInSeconds < 60) {
    return resolve('common.justNow', 'admin.common.justNow')
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${resolve('common.minutes', 'admin.common.minutes')}`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${resolve('common.hours', 'admin.common.hours')}`
  }
  
  // >24h: 按配置时区格式化日期
  if (tz) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(date)
    } catch {
      // 非法时区回退到 UTC
    }
  }
  
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}
