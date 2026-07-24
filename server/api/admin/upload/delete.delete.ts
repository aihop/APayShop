import fs from 'node:fs'
import path from 'node:path'
import { getRequestLocale } from '../../../utils/requestLocale'

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const query = getQuery(event)
  const fileUrl = query.url as string

  if (!fileUrl) {
    throw createError({ statusCode: 400, message: locale === 'zh' ? 'URL 不能为空' : 'URL is required' })
  }

  // Only allow deleting files from the uploads directory or hub blob
  if (!fileUrl.startsWith('/uploads/') && !fileUrl.includes('blob.core.windows.net')) {
    throw createError({ statusCode: 403, message: locale === 'zh' ? '禁止访问' : 'Forbidden' })
  }

  const fileName = fileUrl.split('/').pop() || path.basename(fileUrl)

  // Attempt to use NuxtHub Blob if environment indicates it
  // @ts-ignore
  if (process.env.NUXT_HUB_BLOB || typeof hubBlob === 'function') {
    try {
      // @ts-ignore
      await hubBlob().delete(`uploads/${fileName}`)
      return { success: true, message: locale === 'zh' ? '文件已从 Blob 存储删除' : 'File deleted from blob storage' }
    } catch (error) {
      console.warn('Failed to delete from Hub Blob, falling back to local file system:', error)
    }
  }

  // Fallback to local file system
  const filePath = path.join(process.cwd(), 'uploads', fileName)
  const legacyFilePath = path.join(process.cwd(), 'public', 'uploads', fileName)

  let targetPath = null
  if (fs.existsSync(filePath)) {
    targetPath = filePath
  } else if (fs.existsSync(legacyFilePath)) {
    targetPath = legacyFilePath
  }

  if (targetPath) {
    try {
      fs.unlinkSync(targetPath)
      return { success: true, message: locale === 'zh' ? '文件已删除' : 'File deleted' }
    } catch (e) {
      console.error('Error deleting file', e)
      throw createError({ statusCode: 500, message: locale === 'zh' ? '删除文件失败' : 'Failed to delete file' })
    }
  }

  return { success: false, message: locale === 'zh' ? '文件不存在' : 'File not found' }
})
