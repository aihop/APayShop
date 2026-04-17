import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const form = await readFormData(event)
  
  // Support multiple files ('files') or a single file ('file')
  const files = form.getAll('files') as File[]
  const singleFile = form.get('file') as File
  if (singleFile && !files.length) {
    files.push(singleFile)
  }
  
  if (!files.length || !files[0]?.size) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const urls: string[] = []

  for (const file of files) {
    if (!file.size) continue

    // Attempt to use NuxtHub Blob if environment indicates it
    // @ts-ignore
    if (process.env.NUXT_HUB_BLOB || typeof hubBlob === 'function') {
      try {
        // Generate unique filename using time and random hash
        const ext = file.name ? file.name.split('.').pop() : ''
        const timestamp = Date.now()
        const hash = crypto.randomBytes(8).toString('hex')
        const uniqueName = ext ? `${timestamp}-${hash}.${ext}` : `${timestamp}-${hash}`
        
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
    const ext = path.extname(file.name) || ''
    const timestamp = Date.now()
    const hash = crypto.randomBytes(8).toString('hex')
    const uniqueName = `${timestamp}-${hash}${ext}`
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
