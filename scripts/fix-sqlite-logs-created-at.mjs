import { createClient } from '@libsql/client'

const dbUrl = process.env.LIBSQL_URL || 'file:./.data/db/sqlite.db'
const client = createClient({ url: dbUrl })

const getScalar = async (sql) => {
  const result = await client.execute(sql)
  const row = result.rows?.[0]
  if (!row) return null
  const key = Object.keys(row)[0]
  return row[key]
}

const run = async () => {
  const tableInfo = await client.execute("PRAGMA table_info('logs')")
  const createdAtColumn = tableInfo.rows.find(column => column.name === 'created_at')

  if (!createdAtColumn) {
    console.log('[fix-sqlite-logs-created-at] logs.created_at not found, nothing to do.')
    return
  }

  const totalBefore = Number(await getScalar('SELECT COUNT(*) AS value FROM logs') || 0)
  const textBefore = Number(
    await getScalar("SELECT COUNT(*) AS value FROM logs WHERE typeof(created_at) = 'text'") || 0,
  )
  const integerBefore = Number(
    await getScalar("SELECT COUNT(*) AS value FROM logs WHERE typeof(created_at) = 'integer'") || 0,
  )

  const defaultValue = String(createdAtColumn.dflt_value || '')
  const alreadyNormalized = textBefore === 0 && defaultValue.includes('unixepoch()')

  if (alreadyNormalized) {
    console.log('[fix-sqlite-logs-created-at] logs.created_at is already normalized.')
    console.log(JSON.stringify({
      total: totalBefore,
      integerRows: integerBefore,
      textRows: textBefore,
      defaultValue,
    }, null, 2))
    return
  }

  await client.execute('PRAGMA foreign_keys=OFF')
  await client.execute('BEGIN')

  try {
    await client.execute(`
      CREATE TABLE logs__new (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        level text DEFAULT 'info' NOT NULL,
        message text NOT NULL,
        details text,
        source text,
        created_at integer DEFAULT (unixepoch()) NOT NULL
      )
    `)

    await client.execute(`
      INSERT INTO logs__new (id, level, message, details, source, created_at)
      SELECT
        id,
        level,
        message,
        details,
        source,
        CASE
          WHEN created_at IS NULL THEN CAST(unixepoch() AS integer)
          WHEN typeof(created_at) = 'integer' THEN CAST(created_at AS integer)
          WHEN typeof(created_at) = 'real' THEN CAST(created_at AS integer)
          WHEN typeof(created_at) = 'text'
            AND strftime('%s', trim(created_at)) IS NOT NULL THEN
            CAST(strftime('%s', trim(created_at)) AS integer)
          WHEN typeof(created_at) = 'text' AND trim(created_at) GLOB '[0-9]*' THEN
            CASE
              WHEN length(trim(created_at)) >= 13 THEN CAST(substr(trim(created_at), 1, 10) AS integer)
              ELSE CAST(trim(created_at) AS integer)
            END
          WHEN typeof(created_at) = 'text' THEN CAST(unixepoch() AS integer)
          ELSE CAST(unixepoch() AS integer)
        END
      FROM logs
    `)

    await client.execute('DROP TABLE logs')
    await client.execute('ALTER TABLE logs__new RENAME TO logs')
    await client.execute('COMMIT')
  } catch (error) {
    await client.execute('ROLLBACK')
    throw error
  } finally {
    await client.execute('PRAGMA foreign_keys=ON')
  }

  const tableInfoAfter = await client.execute("PRAGMA table_info('logs')")
  const createdAtColumnAfter = tableInfoAfter.rows.find(column => column.name === 'created_at')
  const totalAfter = Number(await getScalar('SELECT COUNT(*) AS value FROM logs') || 0)
  const textAfter = Number(
    await getScalar("SELECT COUNT(*) AS value FROM logs WHERE typeof(created_at) = 'text'") || 0,
  )
  const integerAfter = Number(
    await getScalar("SELECT COUNT(*) AS value FROM logs WHERE typeof(created_at) = 'integer'") || 0,
  )

  console.log('[fix-sqlite-logs-created-at] logs.created_at migration completed.')
  console.log(JSON.stringify({
    totalBefore,
    textBefore,
    integerBefore,
    totalAfter,
    textAfter,
    integerAfter,
    defaultValueBefore: defaultValue,
    defaultValueAfter: createdAtColumnAfter?.dflt_value || '',
  }, null, 2))
}

run().catch((error) => {
  console.error('[fix-sqlite-logs-created-at] migration failed')
  console.error(error)
  process.exit(1)
})
