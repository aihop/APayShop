import { spawn } from 'child_process'
import path from 'path'

export default defineEventHandler(async (event) => {
  // 1. Validate Admin Authorization
  // Since this is an /api/admin route, it should already be protected by the middleware
  // but we can double check or log it
  
  try {
    // 2. Locate the rebuild script
    const scriptPath = path.join(process.cwd(), 'rebuild.sh')
    
    // 3. Execute asynchronously
    // We use spawn and detached so the API can return immediately
    // If we use exec and wait, the HTTP request might timeout (build takes > 30s)
    console.log(`[System] Initiating async rebuild via ${scriptPath}`)
    
    const child = spawn('bash', [scriptPath], {
      detached: true,
      stdio: 'ignore' // We don't need to capture the output back to the HTTP response
    })
    
    // Unref allows the parent process to exit independently of the child
    child.unref()

    return {
      code: 0,
      message: 'System rebuild initiated. The application will restart in about 30-60 seconds. Please refresh the page later.'
    }
  } catch (error: any) {
    console.error('[System] Failed to initiate rebuild:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to initiate rebuild: ${error.message}`
    })
  }
})