import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const sqlDir = path.join(projectRoot, 'app/themes/qingpu/database')

const orderedFiles = [
  'settings.sql',
  'workspaces.sql',
  'products.sql',
  'assets.sql',
  'stores.sql',
  'channel-drafts.sql',
  'tasks.sql',
  'tenant_keys.sql',
  'publish_records.sql',
  'category_mapping_votes.sql',
  'rule_bundles.sql',
  'kv.sql',
]

const resolveConnectionString = () => {
  const connectionString = process.env.QINGPU_DATABASE_URL || process.env.DATABASE_URL || ''
  if (!connectionString) {
    console.log('[qingpu:init] Skip: no QINGPU_DATABASE_URL or DATABASE_URL found.')
    return null
  }
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    console.log('[qingpu:init] Skip: configured database is not PostgreSQL.')
    return null
  }
  return connectionString
}

const listSqlFiles = async () => {
  const entries = await readdir(sqlDir, { withFileTypes: true })
  const fileNames = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
  const requestedFiles = process.argv.slice(2)
  if (requestedFiles.length) {
    const invalidFiles = requestedFiles.filter(name => !fileNames.includes(name))
    if (invalidFiles.length) {
      throw new Error(`Unknown Qingpu SQL file(s): ${invalidFiles.join(', ')}`)
    }
    return [...new Set(requestedFiles)]
  }

  const extras = fileNames
    .filter(name => !orderedFiles.includes(name))
    .sort((a, b) => a.localeCompare(b))

  return [...orderedFiles.filter(name => fileNames.includes(name)), ...extras]
}

const main = async () => {
  const connectionString = resolveConnectionString()
  if (!connectionString) return

  const client = new Client({ connectionString })
  await client.connect()

  try {
    try {
      await client.query('create extension if not exists pgcrypto;')
    }
    catch (error) {
      console.warn('[qingpu:init] pgcrypto extension was not created automatically:', error.message)
    }

    const files = await listSqlFiles()
    for (const fileName of files) {
      const filePath = path.join(sqlDir, fileName)
      const sql = await readFile(filePath, 'utf8')
      console.log(`[qingpu:init] Applying ${fileName}`)
      await client.query(sql)
    }

    console.log('[qingpu:init] Qingpu database schema is ready.')
  }
  finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('[qingpu:init] Failed to apply Qingpu SQL files.')
  console.error(error)
  process.exitCode = 1
})
