import fs from 'node:fs'
import path from 'node:path'
import { createError, defineEventHandler, getHeader, sendStream, setHeader, setResponseStatus } from 'h3'

const CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

export default defineEventHandler(async (event) => {
  // 获取文件名
  const slug = event.context.params?.slug || ''
  // 这里的 process.cwd() 在生产环境通常指向项目根目录
  const uploadsRoot = path.resolve(process.cwd(), 'uploads')

  // 路径穿越防线:catch-all 参数可能带 ../(含编码变体),归一化后必须仍在
  // uploads 根目录内,否则任意文件读取
  const filePath = path.resolve(uploadsRoot, slug)
  if (filePath !== uploadsRoot && !filePath.startsWith(uploadsRoot + path.sep)) {
    throw createError({ statusCode: 404, statusMessage: 'File Not Found' })
  }

  // 检查文件是否存在
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    const size = fs.statSync(filePath).size
    // 禁止浏览器嗅探为主动内容(HTML/脚本),历史存量文件类型不受上传白名单保护
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Content-Type', CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
    setHeader(event, 'Accept-Ranges', 'bytes')
    const range = String(getHeader(event, 'range') || '').trim()
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (range && !match) {
      setHeader(event, 'Content-Range', `bytes */${size}`)
      throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' })
    }
    if (match) {
      const requestedStart = match[1] ? Number(match[1]) : null
      const requestedEnd = match[2] ? Number(match[2]) : null
      const start = requestedStart === null ? Math.max(size - (requestedEnd || 0), 0) : requestedStart
      const end = requestedStart === null ? size - 1 : Math.min(requestedEnd ?? size - 1, size - 1)
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
        setHeader(event, 'Content-Range', `bytes */${size}`)
        throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' })
      }
      setResponseStatus(event, 206)
      setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
      setHeader(event, 'Content-Length', String(end - start + 1))
      return sendStream(event, fs.createReadStream(filePath, { start, end }))
    }
    setHeader(event, 'Content-Length', String(size))
    // 返回文件流
    return sendStream(event, fs.createReadStream(filePath))
  }

  // 文件不存在抛出 404
  throw createError({
    statusCode: 404,
    statusMessage: 'File Not Found'
  })
})
