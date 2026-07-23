import fs from 'node:fs'
import path from 'node:path'
import { defineEventHandler, createError, setHeader } from 'h3'

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
    // 禁止浏览器嗅探为主动内容(HTML/脚本),历史存量文件类型不受上传白名单保护
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    // 返回文件流
    return sendStream(event, fs.createReadStream(filePath))
  }

  // 文件不存在抛出 404
  throw createError({
    statusCode: 404,
    statusMessage: 'File Not Found'
  })
})
