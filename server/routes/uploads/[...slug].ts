import fs from 'node:fs'
import path from 'node:path'
import { defineEventHandler, createError } from 'h3'

export default defineEventHandler(async (event) => {
  // 获取文件名
  const slug = event.context.params?.slug
  // 这里的 process.cwd() 在生产环境通常指向项目根目录
  const filePath = path.join(process.cwd(), 'uploads', slug)

  // 检查文件是否存在
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    // 返回文件流
    return sendStream(event, fs.createReadStream(filePath))
  }

  // 文件不存在抛出 404
  throw createError({
    statusCode: 404,
    statusMessage: 'File Not Found'
  })
})