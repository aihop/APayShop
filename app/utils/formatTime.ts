 
export function formatRelativeTime(dateInput: string | number | Date, t: any): string {
  if (!dateInput) return ''
  
  const date = new Date(dateInput)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 0 || isNaN(date.getTime())) {
    return date.toLocaleDateString()
  }

  if (diffInSeconds < 60) {
    return t('admin.common.justNow')
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${t('admin.common.minutes')}`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${t('admin.common.hours')}`
  }
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}
