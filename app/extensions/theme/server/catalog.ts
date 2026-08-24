import { sql, type SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db } from '../../../../server/db/runtime'
import { resolveExtensionDatabaseDialect } from '../../../../server/utils/extensions'

const TABLE = 'ext_theme_catalog'
const STATUS_DRAFT = 10
const STATUS_PUBLISHED = 20
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ThemeSettings = { siteURL: string, adminURL: string, gateway: string }
type SeoFields = { title: string, keywords: string, description: string }
type ThemeInput = {
  name: string
  category: string
  slug: string
  imageUrl: string
  subtitle: string
  priceAmount: number
  content: string
  downs: number
  status: 10 | 20
  uniqueName: string
  packageUrl: string
  demoUrl: string
  settings: ThemeSettings
  seo: SeoFields
}
type CatalogRow = Record<string, unknown>

const badRequest = (message: string): never => {
  throw createError({ statusCode: 400, message })
}
const requireObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badRequest(`${label} must be an object`)
  return value as Record<string, unknown>
}
const readString = (value: unknown, label: string, options: { required?: boolean, max: number } = { max: 160 }) => {
  const candidate = value === undefined || value === null ? '' : value
  if (typeof candidate !== 'string') badRequest(`${label} must be a string`)
  const normalized = (candidate as string).trim()
  if (options.required && !normalized) badRequest(`${label} is required`)
  if (normalized.length > options.max) badRequest(`${label} is too long`)
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) badRequest(`${label} contains control characters`)
  return normalized
}
const readInteger = (value: unknown, label: string, max: number) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    badRequest(`${label} must be a non-negative integer`)
  }
  return value as number
}
const readUrl = (value: unknown, label: string) => {
  const normalized = readString(value, label, { max: 2000 })
  if (!normalized) return ''
  let protocol = ''
  try {
    protocol = new URL(normalized).protocol
  } catch {
    badRequest(`${label} must be a valid URL`)
  }
  if (protocol !== 'https:' && protocol !== 'http:') badRequest(`${label} must use HTTP or HTTPS`)
  return normalized
}
const readSettings = (value: unknown): ThemeSettings => {
  const source = value === undefined ? {} : requireObject(value, 'settings')
  return {
    siteURL: readUrl(source.siteURL, 'settings.siteURL'),
    adminURL: readUrl(source.adminURL, 'settings.adminURL'),
    gateway: readUrl(source.gateway, 'settings.gateway'),
  }
}
const readSeo = (value: unknown): SeoFields => {
  const source = value === undefined ? {} : requireObject(value, 'seo')
  return {
    title: readString(source.title, 'seo.title', { max: 300 }),
    keywords: readString(source.keywords, 'seo.keywords', { max: 500 }),
    description: readString(source.description, 'seo.description', { max: 1000 }),
  }
}
const parseInput = (value: unknown): ThemeInput => {
  const source = requireObject(value, 'body')
  const slug = readString(source.slug, 'slug', { required: true, max: 160 })
  if (!SLUG_PATTERN.test(slug)) badRequest('slug must use lowercase kebab-case')
  const status = readInteger(source.status, 'status', STATUS_PUBLISHED)
  if (status !== STATUS_DRAFT && status !== STATUS_PUBLISHED) badRequest('status must be 10 or 20')
  return {
    name: readString(source.name, 'name', { required: true, max: 160 }),
    category: readString(source.category, 'category', { max: 120 }),
    slug,
    imageUrl: readUrl(source.imageUrl, 'imageUrl'),
    subtitle: readString(source.subtitle, 'subtitle', { max: 500 }),
    priceAmount: readInteger(source.priceAmount, 'priceAmount', 999_999_999_999),
    content: readString(source.content, 'content', { max: 200_000 }),
    downs: readInteger(source.downs, 'downs', 2_147_483_647),
    status: status as ThemeInput['status'],
    uniqueName: readString(source.uniqueName, 'uniqueName', { required: true, max: 190 }),
    packageUrl: readUrl(source.packageUrl, 'packageUrl'),
    demoUrl: readUrl(source.demoUrl, 'demoUrl'),
    settings: readSettings(source.settings),
    seo: readSeo(source.seo),
  }
}
const parseJson = <T>(value: unknown, fallback: T): T => {
  try {
    return typeof value === 'string' ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}
const normalizeRows = (result: unknown): CatalogRow[] => {
  if (Array.isArray(result)) {
    if (result.length === 2 && Array.isArray(result[0])) return result[0] as CatalogRow[]
    return result as CatalogRow[]
  }
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) ? rows as CatalogRow[] : []
}
const selectRows = async (query: SQL): Promise<CatalogRow[]> => {
  const result = resolveExtensionDatabaseDialect() === 'sqlite' ? await db.all(query) : await db.execute(query)
  return normalizeRows(result)
}
const mutate = async (query: SQL) => resolveExtensionDatabaseDialect() === 'sqlite' ? db.run(query) : db.execute(query)
const toItem = (row: CatalogRow) => ({
  id: String(row.id),
  name: String(row.name),
  category: String(row.category || ''),
  slug: String(row.slug),
  imageUrl: row.image_url ? String(row.image_url) : '',
  subtitle: String(row.subtitle || ''),
  priceAmount: Number(row.price_amount),
  content: String(row.content || ''),
  downs: Number(row.downs),
  status: Number(row.status) as ThemeInput['status'],
  uniqueName: String(row.unique_name),
  packageUrl: row.package_url ? String(row.package_url) : '',
  demoUrl: row.demo_url ? String(row.demo_url) : '',
  settings: parseJson<ThemeSettings>(row.settings_json, { siteURL: '', adminURL: '', gateway: '' }),
  seo: {
    title: String(row.seo_title || ''),
    keywords: String(row.seo_keywords || ''),
    description: String(row.seo_description || ''),
  },
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})
const parseId = (value: unknown) => {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!ID_PATTERN.test(id)) badRequest('id is invalid')
  return id
}
const findById = async (id: string) => {
  const rows = await selectRows(sql`SELECT * FROM ${sql.identifier(TABLE)} WHERE id = ${id} LIMIT 1`)
  return rows[0] ? toItem(rows[0]) : null
}
const assertUnique = async (slug: string, uniqueName: string, excludedId = '') => {
  const rows = await selectRows(sql`
    SELECT id FROM ${sql.identifier(TABLE)}
    WHERE (slug = ${slug} OR unique_name = ${uniqueName})
      ${excludedId ? sql`AND id <> ${excludedId}` : sql``}
    LIMIT 1
  `)
  if (rows.length) throw createError({ statusCode: 409, message: 'slug or uniqueName already exists' })
}
const translateUniqueError = (error: unknown): never => {
  if (/unique|duplicate/i.test(error instanceof Error ? error.message : String(error))) {
    throw createError({ statusCode: 409, message: 'slug or uniqueName already exists' })
  }
  throw error
}

export const listThemes = async (event: H3Event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(query.pageSize || '15'), 10) || 15))
  const keyword = readString(query.keyword, 'keyword', { max: 100 })
  const rawStatus = query.status === undefined || query.status === '' ? 0 : Number(query.status)
  if (rawStatus !== 0 && rawStatus !== STATUS_DRAFT && rawStatus !== STATUS_PUBLISHED) badRequest('status must be 10 or 20')
  const search = keyword ? `%${keyword}%` : ''
  const where = sql`
    WHERE (${rawStatus} = 0 OR status = ${rawStatus})
      AND (${search} = '' OR LOWER(name) LIKE LOWER(${search}) OR LOWER(slug) LIKE LOWER(${search}) OR LOWER(unique_name) LIKE LOWER(${search}) OR LOWER(category) LIKE LOWER(${search}))
  `
  const countRows = await selectRows(sql`SELECT COUNT(*) AS total FROM ${sql.identifier(TABLE)} ${where}`)
  const rows = await selectRows(sql`
    SELECT * FROM ${sql.identifier(TABLE)} ${where}
    ORDER BY updated_at DESC, id DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)
  return { data: rows.map(toItem), total: Number(countRows[0]?.total || 0), page, pageSize }
}
export const getTheme = async (event: H3Event) => {
  const item = await findById(parseId(getQuery(event).id))
  if (!item) throw createError({ statusCode: 404, message: 'Theme not found' })
  return item
}
export const createTheme = async (event: H3Event) => {
  const input = parseInput(await readBody(event))
  await assertUnique(input.slug, input.uniqueName)
  const id = globalThis.crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await mutate(sql`
      INSERT INTO ${sql.identifier(TABLE)} (
        id, name, category, slug, image_url, subtitle, price_amount, content, downs, status,
        unique_name, package_url, demo_url, settings_json, seo_title, seo_keywords, seo_description, created_at, updated_at
      ) VALUES (
        ${id}, ${input.name}, ${input.category}, ${input.slug}, ${input.imageUrl || null}, ${input.subtitle},
        ${input.priceAmount}, ${input.content}, ${input.downs}, ${input.status}, ${input.uniqueName},
        ${input.packageUrl || null}, ${input.demoUrl || null}, ${JSON.stringify(input.settings)}, ${input.seo.title},
        ${input.seo.keywords}, ${input.seo.description}, ${now}, ${now}
      )
    `)
  } catch (error) {
    translateUniqueError(error)
  }
  return findById(id)
}
export const updateTheme = async (event: H3Event) => {
  const body = requireObject(await readBody(event), 'body')
  const id = parseId(body.id)
  if (!await findById(id)) throw createError({ statusCode: 404, message: 'Theme not found' })
  const input = parseInput(body)
  await assertUnique(input.slug, input.uniqueName, id)
  const now = new Date().toISOString()
  try {
    await mutate(sql`
      UPDATE ${sql.identifier(TABLE)} SET
        name = ${input.name}, category = ${input.category}, slug = ${input.slug}, image_url = ${input.imageUrl || null},
        subtitle = ${input.subtitle}, price_amount = ${input.priceAmount}, content = ${input.content},
        downs = ${input.downs}, status = ${input.status}, unique_name = ${input.uniqueName}, package_url = ${input.packageUrl || null},
        demo_url = ${input.demoUrl || null}, settings_json = ${JSON.stringify(input.settings)}, seo_title = ${input.seo.title},
        seo_keywords = ${input.seo.keywords}, seo_description = ${input.seo.description}, updated_at = ${now}
      WHERE id = ${id}
    `)
  } catch (error) {
    translateUniqueError(error)
  }
  return findById(id)
}
export const deleteTheme = async (event: H3Event) => {
  const id = parseId(getQuery(event).id)
  const existing = await findById(id)
  if (!existing) throw createError({ statusCode: 404, message: 'Theme not found' })
  if (existing.status === STATUS_PUBLISHED) {
    throw createError({ statusCode: 409, message: 'Published themes must be changed to draft before deletion' })
  }
  await mutate(sql`DELETE FROM ${sql.identifier(TABLE)} WHERE id = ${id} AND status = ${STATUS_DRAFT}`)
  return { deleted: true, id }
}
