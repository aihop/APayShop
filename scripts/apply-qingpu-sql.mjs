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
  'ainode_task_events.sql',
  'tenant_keys.sql',
  'publish_records.sql',
  'category_mapping_votes.sql',
  'rule_bundles.sql',
  'kv.sql',
]

/**
 * 显式调用初始化命令却「跳过」并返回成功,是这套流程最危险的行为:
 * 2026-08 真实事故——tasks.sql 里 qingpu_task_image_slot_leases 的建表语句早已写好,
 * 但脚本因为读不到连接串而静默 Skip + exit 0,表始终没建;runner 的认领 SQL 无条件
 * 引用它,于是每次 claimNextTask 直接抛异常,整个任务队列彻底停摆。前端只表现为
 * 「任务一直排队」,异常只进服务端日志,极难定位。
 *
 * 现在一律以非零退出码失败:这个脚本没有「顺带跑一下」的调用方(只在 db:qingpu:init
 * 与 deploy_cf.sh 里显式调用),调用即意味着调用方要求 schema 就绪。
 */
const resolveConnectionString = () => {
  const connectionString = process.env.QINGPU_DATABASE_URL || process.env.DATABASE_URL || ''
  if (!connectionString) {
    throw new Error(
      'no QINGPU_DATABASE_URL or DATABASE_URL found.\n'
      + '  npm script 已带 --env-file-if-exists=.env;若仍缺失,请确认 .env 存在或显式导出环境变量。',
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    throw new Error(
      `configured database is not PostgreSQL (${connectionString.split('://')[0] || 'unknown'}://…).\n`
      + '  Qingpu 主题的私有表只支持 PostgreSQL;若本环境确实不跑 Qingpu,请不要调用本命令。',
    )
  }
  return connectionString
}

/** 从 SQL 文件里解析出本次应当存在的表名,用作应用后的自检清单(随 SQL 自动同步,不手维护) */
const parseExpectedTables = (sqlText) => (
  [...sqlText.matchAll(/create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi)].map(match => match[1])
)

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
    const expectedTables = new Set()
    for (const fileName of files) {
      const filePath = path.join(sqlDir, fileName)
      const sql = await readFile(filePath, 'utf8')
      console.log(`[qingpu:init] Applying ${fileName}`)
      await client.query(sql)
      for (const table of parseExpectedTables(sql)) expectedTables.add(table)
    }

    // 应用成功不等于表就绪:核心表若属于别的 owner,ALTER 会中断在半路;这里以
    // 「表是否真的存在」做最终判据,把「跑完了但没建出来」这种静默失败挡在部署阶段。
    const { rows } = await client.query(
      'select tablename from pg_tables where schemaname = current_schema() and tablename = any($1)',
      [[...expectedTables]],
    )
    const missing = [...expectedTables].filter(table => !rows.some(row => row.tablename === table))
    if (missing.length) {
      throw new Error(`schema applied but these tables are still missing: ${missing.join(', ')}`)
    }

    // 约束名漂移巡检:PostgreSQL 改表名不改约束名,重命名过的表会留下旧名约束。
    // 它们不会报错,但会与按规范名重建的同类约束**并存**,旧的那条继续按旧定义拦截
    // ——2026-08 实测:qingpu_tasks 由 qingpu_listing_tasks 改名而来,残留的
    // qingpu_listing_tasks_status_check 让写入 paused 一直失败,而 pg_get_constraintdef
    // 查规范名那条显示完全正确,极难定位。
    // 只巡检 CHECK 与 UNIQUE:定义写在名字背后、能静默分叉的就这两类;
    // 主键/外键/非空即使名字陈旧也只是命名问题,不影响语义,不在此报警。
    const { rows: drifted } = await client.query(
      `select t.relname as table_name, c.conname as constraint_name, c.contype
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = current_schema()
         and t.relname = any($1)
         and c.contype in ('c', 'u')
         and c.conname not like t.relname || '%'
       order by t.relname, c.conname`,
      [[...expectedTables]],
    )
    if (drifted.length) {
      console.warn('[qingpu:init] ⚠ 检测到约束名与表名不匹配(疑似改表名后的残留),同名同类约束可能并存并按旧定义拦截:')
      for (const row of drifted) {
        console.warn(`  - ${row.table_name}: ${row.constraint_name} (${row.contype === 'c' ? 'CHECK' : 'UNIQUE'})`)
      }
      console.warn('  处理方式:在对应 database/*.sql 里 `drop constraint if exists <旧名>` 后按规范名重建。')
    }

    console.log(
      `[qingpu:init] Qingpu database schema is ready (${expectedTables.size} tables verified`
      + `${drifted.length ? `, ${drifted.length} constraint name(s) need attention` : ''}).`,
    )
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
