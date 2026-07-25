/**
 * Presentation helpers shared by the three log tabs
 * (app/components/admin/logs/*Tab.vue). Kept out of the components themselves
 * because status-code colouring and JSON pretty-printing are identical across
 * system, access and operation logs.
 */
export function useLogFormatters() {
  const getLevelColor = (level?: string): 'error' | 'warning' | 'neutral' | 'primary' => {
    switch (level?.toLowerCase()) {
      case 'error':
        return 'error'
      case 'warn':
        return 'warning'
      case 'debug':
        return 'neutral'
      case 'info':
      default:
        return 'primary'
    }
  }

  const getMethodColor = (method?: string): 'neutral' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'success'
      case 'POST': return 'primary'
      case 'PUT': return 'warning'
      case 'DELETE': return 'error'
      case 'PATCH': return 'warning'
      default: return 'neutral'
    }
  }

  const getStatusCodeClass = (code?: number) => {
    if (!code) return 'text-gray-500 bg-gray-100 dark:bg-gray-900'
    if (code < 300) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
    if (code < 400) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
    if (code < 500) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
  }

  /** Pretty-print a JSON string column, falling back to the raw text. */
  const formatDetails = (details: unknown) => {
    if (typeof details !== 'string' || !details) return ''
    try {
      return JSON.stringify(JSON.parse(details), null, 2)
    } catch {
      return details
    }
  }

  const shortId = (id?: string | null) => {
    if (!id || id.length <= 12) return id || ''
    return `${id.slice(0, 8)}...${id.slice(-4)}`
  }

  return {
    getLevelColor,
    getMethodColor,
    getStatusCodeClass,
    formatDetails,
    shortId,
  }
}
