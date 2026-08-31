#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const themeRoot = path.resolve(__dirname, '..')
const sqlDir = path.join(themeRoot, 'database')

const ARTIFACT_DRIVER_DIR = new URL('../.output/server/node_modules/postgres/', import.meta.url)

const loadPostgresDriver = async () => {
  try {
    return (await import('postgres')).default
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
  }

  try {
    const manifest = JSON.parse(await readFile(new URL('package.json', ARTIFACT_DRIVER_DIR), 'utf8'))
    const entry = manifest.exports?.import || manifest.module || manifest.main
    if (!entry) throw new Error('postgres package.json exposes no ESM entry')
    return (await import(new URL(entry, ARTIFACT_DRIVER_DIR))).default
  } catch (error) {
    throw new Error(
      'cannot load the postgres driver.\n' +
      `  源码树解析失败,产物回落(${fileURLToPath(ARTIFACT_DRIVER_DIR)})也失败: ${error.message}\n` +
      '  源码树请先 npm install; 产物包请确认 .output/server/node_modules/postgres 随构建产出。'
    )
  }
}

const CONNECTION_ENV_KEYS = ['GORAY_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL']

const resolveConnectionString = () => {
  const connectionString = CONNECTION_ENV_KEYS
    .map(key => (process.env[key] || '').replace(/"/g, '').trim())
    .find(Boolean) || ''
  if (!connectionString) {
    throw new Error(
      `no database URL found (tried ${CONNECTION_ENV_KEYS.join(', ')}).\n` +
      '  请确认配置了 GORAY_DATABASE_URL 环境变量。'
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    throw new Error(
      `configured database is not PostgreSQL (${connectionString.split('://')[0] || 'unknown'}://…).\n` +
      '  Goray 主题的私有表只支持 PostgreSQL。'
    )
  }
  return connectionString
}

const sha256 = (content) => createHash('sha256').update(content).digest('hex')

const runMigrations = async (isCheckOnly = false) => {
  const connectionString = resolveConnectionString()
  const postgres = await loadPostgresDriver()
  const sql = postgres(connectionString, { max: 1, connect_timeout: 10 })

  try {
    // 确保迁移表存在
    await sql`
      CREATE TABLE IF NOT EXISTS goray_schema_migrations (
          version             BIGINT PRIMARY KEY,
          name                VARCHAR(191) NOT NULL,
          checksum_sha256     CHAR(64) NOT NULL,
          applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          execution_ms        INTEGER NOT NULL CHECK (execution_ms >= 0)
      )
    `

    const appliedRows = await sql`
      SELECT version, name, checksum_sha256 FROM goray_schema_migrations ORDER BY version ASC
    `
    const appliedMap = new Map(appliedRows.map(r => [Number(r.version), r]))

    const files = (await readdir(sqlDir))
      .filter(f => f.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.warn('[goray-migration] No SQL files found in', sqlDir)
      return
    }

    for (const filename of files) {
      const match = filename.match(/^(\d+)_(.+)\.sql$/)
      if (!match) {
        console.warn(`[goray-migration] Skipping non-standard migration filename: ${filename}`)
        continue
      }
      const version = Number(match[1])
      const name = match[2]
      const fullPath = path.join(sqlDir, filename)
      const content = await readFile(fullPath, 'utf8')
      const checksum = sha256(content)

      const existing = appliedMap.get(version)
      if (existing) {
        if (existing.checksum_sha256 !== checksum) {
          throw new Error(
            `[goray-migration] Checksum mismatch for migration ${version} (${filename})!\n` +
            `  Applied:  ${existing.checksum_sha256}\n` +
            `  Current:  ${checksum}\n` +
            '  Migrations must be append-only and immutable.'
          )
        }
        if (isCheckOnly) {
          continue
        }
        console.log(`[goray-migration] Version ${version} (${filename}) already applied.`)
        continue
      }

      if (isCheckOnly) {
        throw new Error(`[goray-migration] Pending migration detected: ${filename}`)
      }

      console.log(`[goray-migration] Applying version ${version}: ${filename}...`)
      const startTime = Date.now()
      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        const executionMs = Date.now() - startTime
        await tx`
          INSERT INTO goray_schema_migrations (version, name, checksum_sha256, execution_ms)
          VALUES (${version}, ${name}, ${checksum}, ${executionMs})
        `
      })
      console.log(`[goray-migration] Successfully applied ${filename} in ${Date.now() - startTime}ms.`)
    }

    console.log('[goray-migration] All migrations are up to date.')
  } finally {
    await sql.end()
  }
}

const isCheck = process.argv.includes('--check')
runMigrations(isCheck).catch((err) => {
  console.error('[goray-migration] Execution failed:', err)
  process.exit(1)
})
