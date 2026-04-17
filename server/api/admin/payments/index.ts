import { paymentMethods } from "../../../db/schema"
import fs from "fs"
import path from "path"
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    // 1. Fetch from database
    const dbMethods = await db.select().from(paymentMethods)
    
    // 2. Scan local payments/ directory
    const paymentsDir = path.resolve(process.cwd(), 'payments')
    let localPlugins: string[] = []
    
    if (fs.existsSync(paymentsDir)) {
      localPlugins = fs.readdirSync(paymentsDir).filter(item => {
        const itemPath = path.join(paymentsDir, item)
        return fs.statSync(itemPath).isDirectory()
      })
    }
    
    // 3. Merge them
    const mergedMethods = [...dbMethods]
    
    for (const pluginCode of localPlugins) {
      // Check if this plugin already exists in DB
      const existsInDb = dbMethods.find((m: any) => m.code === pluginCode)
      
      if (!existsInDb) {
        // Read local files to pre-fill the form
        let info = ''
        let create = ''
        let callback = ''
        
        try {
          const infoPath = path.join(paymentsDir, pluginCode, 'info.html')
          if (fs.existsSync(infoPath)) info = fs.readFileSync(infoPath, 'utf-8')
          
          const callbackPath = path.join(paymentsDir, pluginCode, 'callback.js')
          if (fs.existsSync(callbackPath)) callback = fs.readFileSync(callbackPath, 'utf-8')

          const createPath = path.join(paymentsDir, pluginCode, 'create.js')
          if (fs.existsSync(createPath)) create = fs.readFileSync(createPath, 'utf-8')
        } catch (e) {
          console.error(`Error reading local plugin ${pluginCode}:`, e)
        }
        
        // Push as a new "Unconfigured" method
        mergedMethods.push({
          id: null as any, // Null ID indicates it's not in DB yet
          name: pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1),
          code: pluginCode,
          iconUrl: '',
          isActive: false,
          configJson: '{}',
          info,
          create,
          callback,
          createdAt: new Date(),
          isLocalOnly: true // custom flag for frontend
        } as any)
      } else {
        // If it exists in DB, we could optionally attach a flag saying it has local files backing it
        (existsInDb as any).hasLocalFiles = true
      }
    }
    
    return mergedMethods
  }
  
  if (event.method === "POST") {
    const body = await readBody(event)
    const insertData = { ...body }
    delete insertData.id
    delete insertData.createdAt
    delete insertData.isLocalOnly
    delete insertData.hasLocalFiles
    
    // Ensure script/html fields are passed as strings
    if (insertData.info === undefined) insertData.info = null
    if (insertData.create === undefined) insertData.create = null
    if (insertData.callback === undefined) insertData.callback = null
    
    try {
      return await db.insert(paymentMethods).values(insertData).returning()
    } catch (e: any) {
      console.error('Database insert error:', e)
      throw createError({
        statusCode: 500,
        message: 'Failed query: ' + e.message,
      })
    }
  }
})
