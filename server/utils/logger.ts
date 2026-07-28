import { logs } from '../db/schema'
// 必须显式导入:此前这里直接用裸 `db`,靠 Nitro 自动导入解析,实际拿到的并不是
// server/db/runtime 的连接,于是 insert 既不报错也不落库——全站 logger.* 的写入
// 被静默吞掉,系统日志里只剩下少数几处显式 import 了 db 的调用方。
import { db } from '../db/runtime'

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