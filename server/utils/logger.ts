import { logs } from '../db/schema'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogOptions {
  level?: LogLevel
  details?: any
  source?: string
}

export const logger = {
  async log(message: string, options?: LogOptions) {
    try {
      let detailsString = null
      if (options?.details) {
        detailsString = typeof options.details === 'string' 
          ? options.details 
          : JSON.stringify(options.details)
      }

      await db.insert(logs).values({
        level: options?.level || 'info',
        message,
        details: detailsString,
        source: options?.source || 'system',
        createdAt: new Date()
      })
    } catch (e) {
      console.error('Failed to write to logs table:', e)
    }
  },

  async info(message: string, options?: Omit<LogOptions, 'level'>) {
    return this.log(message, { ...options, level: 'info' })
  },

  async warn(message: string, options?: Omit<LogOptions, 'level'>) {
    return this.log(message, { ...options, level: 'warn' })
  },

  async error(message: string, options?: Omit<LogOptions, 'level'>) {
    return this.log(message, { ...options, level: 'error' })
  },

  async debug(message: string, options?: Omit<LogOptions, 'level'>) {
    return this.log(message, { ...options, level: 'debug' })
  }
}