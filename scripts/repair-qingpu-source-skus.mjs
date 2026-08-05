import postgres from 'postgres'
import {
  AINODE_CRAWL_1688_RAW_PROVIDER,
  normalizeAinodeCrawl1688Product,
} from '../app/themes/qingpu/server/vendor/qingpu-engine/index.js'

const apply = process.argv.includes('--apply')
const requestedProductIds = process.argv
  .filter(argument => argument.startsWith('--product-id='))
  .map(argument => argument.slice('--product-id='.length).trim())
  .filter(Boolean)

const connectionString = (
  process.env.QINGPU_DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.POSTGRESQL_URL
  || process.env.DATABASE_URL
  || ''
).replace(/"/g, '').trim()

if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
  throw new Error('Missing PostgreSQL QINGPU_DATABASE_URL or DATABASE_URL')
}

const asRecord = value => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
)
const variantId = variant => String(variant?.id || '').trim()

const mergeVariantDimensions = (variants, currentDimensions, sourceDimensions) => {
  const metadata = new Map()
  const order = []
  for (const dimensions of [sourceDimensions, currentDimensions]) {
    if (!Array.isArray(dimensions)) continue
    for (const dimension of dimensions) {
      const record = asRecord(dimension)
      const name = String(record?.name || '').trim()
      if (!record || !name) continue
      if (!order.includes(name)) order.push(name)
      const previous = metadata.get(name) || {}
      metadata.set(name, {
        ...previous,
        ...record,
        valueImages: {
          ...(asRecord(previous.valueImages) || {}),
          ...(asRecord(record.valueImages) || {}),
        },
      })
    }
  }
  const valuesByDimension = new Map()
  for (const variant of variants) {
    for (const [rawName, rawValue] of Object.entries(asRecord(variant.optionValues) || {})) {
      const name = String(rawName || '').trim()
      const value = String(rawValue || '').trim()
      if (!name || !value) continue
      if (!order.includes(name)) order.push(name)
      const values = valuesByDimension.get(name) || []
      if (!values.includes(value)) values.push(value)
      valuesByDimension.set(name, values)
    }
  }
  return order.map((name) => {
    const meta = metadata.get(name) || {}
    const values = valuesByDimension.get(name) || []
    const images = asRecord(meta.valueImages) || {}
    const valueImages = Object.fromEntries(Object.entries(images).filter(([value]) => values.includes(value)))
    return {
      ...meta,
      name,
      values,
      ...(Object.keys(valueImages).length ? { valueImages } : { valueImages: undefined }),
    }
  })
}

const inspectRow = (row) => {
  const canonical = asRecord(row.canonical) || {}
  const extra = asRecord(canonical.extra)
  const raw = asRecord(extra?.raw)
  const payload = asRecord(raw?.payload)
  if (String(raw?.provider || '').trim() !== AINODE_CRAWL_1688_RAW_PROVIDER || !payload) return null

  const normalized = normalizeAinodeCrawl1688Product(
    payload,
    String(row.source_url || ''),
    { productId: row.product_id, fetchedAt: Number(raw.fetchedAt) || undefined },
  )
  const currentVariants = Array.isArray(canonical.variants) ? canonical.variants.filter(asRecord) : []
  const normalizedVariants = Array.isArray(normalized.variants) ? normalized.variants.filter(asRecord) : []
  const currentIds = new Set(currentVariants.map(variantId).filter(Boolean))
  const missingVariants = normalizedVariants.filter(variant => variantId(variant) && !currentIds.has(variantId(variant)))
  if (!missingVariants.length) return null

  const variants = [...currentVariants, ...missingVariants]
  const prices = variants.map(variant => Number(variant.price)).filter(price => Number.isFinite(price) && price > 0)
  const nextCanonical = {
    ...canonical,
    pricing: {
      ...(asRecord(canonical.pricing) || {}),
      ...(prices.length ? { priceMin: Math.min(...prices), priceMax: Math.max(...prices) } : {}),
    },
    variants,
    variantDimensions: mergeVariantDimensions(variants, canonical.variantDimensions, normalized.variantDimensions),
  }
  const workspace = asRecord(row.workspace) || {}
  const manualOverrides = asRecord(workspace.manualOverrides) || {}
  const excludedSkuIds = Array.isArray(manualOverrides.excludedSkuIds)
    ? manualOverrides.excludedSkuIds.map(value => String(value || '').trim()).filter(Boolean)
    : []
  const missingIds = missingVariants.map(variantId)
  const nextWorkspace = {
    ...workspace,
    manualOverrides: {
      ...manualOverrides,
      excludedSkuIds: [...new Set([...excludedSkuIds, ...missingIds])],
    },
  }
  return {
    userId: Number(row.user_id),
    productId: row.product_id,
    beforeSkuCount: currentVariants.length,
    afterSkuCount: variants.length,
    restored: missingVariants.map(variant => ({
      id: variantId(variant),
      price: Number(variant.price) || null,
      optionValues: variant.optionValues || {},
    })),
    nextCanonical,
    nextWorkspace,
  }
}

const sql = postgres(connectionString, { max: 1, prepare: false })
try {
  const rows = requestedProductIds.length
    ? await sql`
        select p.user_id, p.product_id, p.source_url, p.canonical, coalesce(w.workspace, '{}'::jsonb) as workspace
        from qingpu_listing_products p
        left join qingpu_listing_workspaces w
          on w.user_id = p.user_id and w.product_id = p.product_id and w.deleted_at is null
        where p.deleted_at is null and p.product_id in ${sql(requestedProductIds)}
      `
    : await sql`
        select p.user_id, p.product_id, p.source_url, p.canonical, coalesce(w.workspace, '{}'::jsonb) as workspace
        from qingpu_listing_products p
        left join qingpu_listing_workspaces w
          on w.user_id = p.user_id and w.product_id = p.product_id and w.deleted_at is null
        where p.deleted_at is null
          and p.canonical #>> '{extra,raw,provider}' = ${AINODE_CRAWL_1688_RAW_PROVIDER}
      `
  const repairs = rows.map(inspectRow).filter(Boolean)
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', products: repairs.map(({ userId, nextCanonical, nextWorkspace, ...summary }) => summary) }, null, 2))

  if (apply && repairs.length) {
    await sql.begin(async transaction => {
      for (const repair of repairs) {
        const products = await transaction`
          update qingpu_listing_products
          set canonical = ${transaction.json(repair.nextCanonical)},
              sku_count = ${repair.afterSkuCount},
              revision = revision + 1,
              updated_at = now()
          where user_id = ${repair.userId} and product_id = ${repair.productId} and deleted_at is null
          returning user_id
        `
        if (products.length !== 1) throw new Error(`Expected one product row for ${repair.productId}`)
        await transaction`
          insert into qingpu_listing_workspaces (
            user_id, product_id, workspace, schema_version, updated_by, updated_at
          )
          values (
            ${repair.userId}, ${repair.productId}, ${transaction.json(repair.nextWorkspace)},
            1, 'server', now()
          )
          on conflict (user_id, product_id) do update set
            workspace = excluded.workspace,
            updated_by = 'server',
            deleted_at = null,
            updated_at = now()
        `
      }
    })
    console.log(`[qingpu:source-sku-repair] repaired ${repairs.length} product(s)`)
  }
}
finally {
  await sql.end()
}
