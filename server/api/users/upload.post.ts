import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { getRequestLocale } from '../../utils/requestLocale'

// 上传硬限制:无限制的多文件全量读内存曾是内存/配额耗尽点;扩展名白名单
// 防止同源托管 HTML/SVG 等主动内容与伪装恶意文件(需要新类型时在这里扩)
const MAX_FILES_PER_REQUEST = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])
const ALLOWED_MIME_PREFIX = 'image/'

const resolveSafeExtension = (fileName: string, mimeType: string): string | null => {
  const ext = path.extname(fileName || '').replace('.', '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) return null
  if (mimeType && !mimeType.toLowerCase().startsWith(ALLOWED_MIME_PREFIX)) return null
  return ext
}

export default defineEventHandler(async (event) => {
  const locale = getRequestLocale(event)
  const messages = locale === 'zh'
    ? {
        unauthorized: '未登录',
        noFileUploaded: '未上传文件',
        tooManyFiles: `文件数量过多（最多 ${MAX_FILES_PER_REQUEST} 个）`,
        fileTooLarge: `文件过大（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
        unsupportedFileType: '不支持的文件类型（仅支持图片）',
      }
    : {
        unauthorized: 'Unauthorized',
        noFileUploaded: 'No file uploaded',
        tooManyFiles: `Too many files (max ${MAX_FILES_PER_REQUEST})`,
        fileTooLarge: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        unsupportedFileType: 'Unsupported file type (images only)',
      }
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: messages.unauthorized })
  }

  const form = await readFormData(event)

  // Support multiple files ('files') or a single file ('file')
  const files = form.getAll('files') as File[]
  const singleFile = form.get('file') as File
  if (singleFile && !files.length) {
    files.push(singleFile)
  }

  if (!files.length || !files[0]?.size) {
    throw createError({ statusCode: 400, message: messages.noFileUploaded })
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    throw createError({ statusCode: 400, message: messages.tooManyFiles })
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw createError({ statusCode: 413, message: messages.fileTooLarge })
    }
    if (file.size && !resolveSafeExtension(file.name || '', file.type || '')) {
      throw createError({ statusCode: 400, message: messages.unsupportedFileType })
    }
  }

  const urls: string[] = []

  for (const file of files) {
    if (!file.size) continue
    const safeExt = resolveSafeExtension(file.name || '', file.type || '')!

    // Attempt to use NuxtHub Blob if environment indicates it
    // @ts-ignore
    if (process.env.NUXT_HUB_BLOB || typeof hubBlob === 'function') {
      try {
        // Generate unique filename using time and random hash
        const timestamp = Date.now()
        const hash = crypto.randomBytes(8).toString('hex')
        const uniqueName = `${timestamp}-${hash}.${safeExt}`

        // Upload to NuxtHub Blob
        // @ts-ignore
        const blob = await hubBlob().put(`uploads/users/${session.user.id}/${uniqueName}`, file, {
          addRandomSuffix: false
        })
        urls.push(blob.pathname)
        continue
      } catch (error) {
        console.warn('Failed to upload to Hub Blob, falling back to local file system:', error)
      }
    }

    // Fallback to local file system
    const uploadDir = path.join(process.cwd(), '/uploads', 'users', session.user.id.toString())
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename using time and random hash
    const timestamp = Date.now()
    const hash = crypto.randomBytes(8).toString('hex')
    const uniqueName = `${timestamp}-${hash}.${safeExt}`
    const filePath = path.join(uploadDir, uniqueName)

    // Write file to local directory
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    urls.push(`/uploads/users/${session.user.id}/${uniqueName}`)
  }

  return {
    urls,
    url: urls[0]
  }
})
