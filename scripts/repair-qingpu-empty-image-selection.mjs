import postgres from 'postgres'

/**
 * Qingpu Listing「原图被全部排除」一次性数据修复。
 *
 * 功能：
 * - 检查 `qingpu_listing_products.canonical.media.images[]` 仍有有效原图、但
 *   `compat.images[]` 对应槽位全部 `_deleted=true` 的非法状态。
 * - 只恢复 canonical `role=main` 的原图；没有 main 时恢复第一张有效原图。
 * - 同步把该槽位 ID 写入 `qingpu_listing_workspaces.workspace.media.selectedImageAssetIds`，
 *   避免下一次 Product 投影再次把它删除；其他图片的用户筛选状态保持不变。
 * - 商品 `revision` 加一，扩展与网页端继续按既有增量同步协议感知变化。
 *
 * 使用：
 * 1. 默认 dry-run：
 *    `node --env-file=.env scripts/repair-qingpu-empty-image-selection.mjs`
 * 2. 指定商品：
 *    `node --env-file=.env scripts/repair-qingpu-empty-image-selection.mjs --product-id=<商品ID>`
 * 3. 确认清单后执行：
 *    `node --env-file=.env scripts/repair-qingpu-empty-image-selection.mjs --apply`
 *
 * 数据库连接按顺序读取 `QINGPU_DATABASE_URL / POSTGRES_URL / POSTGRESQL_URL / DATABASE_URL`。
 * `--apply` 在单事务内以 revision 做 CAS；并发修改会整体回滚。脚本只修非法全删状态，
 * 修复后再次运行应显示 affectedProducts=0（幂等）。
 */
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
const normalizeImageUrl = (value) => {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

const inspectRow = (row) => {
  const canonical = asRecord(row.canonical) || {}
  const media = asRecord(canonical.media) || {}
  const canonicalImages = Array.isArray(media.images) ? media.images.map(asRecord).filter(Boolean) : []
  const compat = asRecord(row.compat) || {}
  const compatImages = Array.isArray(compat.images) ? compat.images : []
  const validImages = canonicalImages.filter(image => normalizeImageUrl(image.originalUrl))
  if (!validImages.length) return null

  const allDeleted = validImages.every((image, arrayIndex) => {
    const originalIndex = Number.isInteger(Number(image.originalIndex)) ? Number(image.originalIndex) : arrayIndex
    return asRecord(compatImages[originalIndex])?._deleted === true
  })
  if (!allDeleted) return null

  const fallback = validImages.find(image => image.role === 'main') || validImages[0]
  const fallbackArrayIndex = canonicalImages.indexOf(fallback)
  const originalIndex = Number.isInteger(Number(fallback.originalIndex))
    ? Number(fallback.originalIndex)
    : fallbackArrayIndex
  const fallbackCompat = asRecord(compatImages[originalIndex]) || {}
  const nextCompatImages = compatImages.map((image, index) => (
    index === originalIndex ? { ...fallbackCompat, _deleted: false } : image
  ))
  const workspace = asRecord(row.workspace) || {}
  const workspaceMedia = asRecord(workspace.media) || {}
  const fallbackImageId = String(fallback.id || '').trim()
  if (!fallbackImageId || !nextCompatImages[originalIndex]) return null

  return {
    userId: Number(row.user_id),
    productId: String(row.product_id),
    baseRevision: Number(row.revision),
    fallbackImageId,
    originalIndex,
    nextCompat: { ...compat, images: nextCompatImages },
    nextWorkspace: {
      ...workspace,
      media: { ...workspaceMedia, selectedImageAssetIds: [fallbackImageId] },
    },
  }
}

const sql = postgres(connectionString, { max: 1, prepare: false })
try {
  const rows = requestedProductIds.length
    ? await sql`
        select p.user_id, p.product_id, p.revision, p.canonical, p.compat,
               coalesce(w.workspace, '{}'::jsonb) as workspace
        from qingpu_listing_products p
        left join qingpu_listing_workspaces w
          on w.user_id = p.user_id and w.product_id = p.product_id and w.deleted_at is null
        where p.deleted_at is null and p.product_id in ${sql(requestedProductIds)}
        order by p.user_id, p.product_id
      `
    : await sql`
        select p.user_id, p.product_id, p.revision, p.canonical, p.compat,
               coalesce(w.workspace, '{}'::jsonb) as workspace
        from qingpu_listing_products p
        left join qingpu_listing_workspaces w
          on w.user_id = p.user_id and w.product_id = p.product_id and w.deleted_at is null
        where p.deleted_at is null
        order by p.user_id, p.product_id
      `
  const repairs = rows.map(inspectRow).filter(Boolean)
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    scannedProducts: rows.length,
    affectedProducts: repairs.length,
    products: repairs.map(({ userId, productId, baseRevision, fallbackImageId, originalIndex }) => ({
      userId,
      productId,
      baseRevision,
      fallbackImageId,
      originalIndex,
    })),
  }, null, 2))

  if (apply && repairs.length) {
    await sql.begin(async (transaction) => {
      for (const repair of repairs) {
        const updated = await transaction`
          update qingpu_listing_products
          set compat = ${transaction.json(repair.nextCompat)},
              revision = revision + 1,
              updated_at = now()
          where user_id = ${repair.userId}
            and product_id = ${repair.productId}
            and revision = ${repair.baseRevision}
            and deleted_at is null
          returning revision
        `
        if (updated.length !== 1) {
          throw new Error(`Product changed during repair: ${repair.productId}; rerun dry-run`)
        }
        await transaction`
          insert into qingpu_listing_workspaces (
            user_id, product_id, workspace, schema_version, updated_by, updated_at
          ) values (
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
    console.log(`[qingpu:empty-image-selection-repair] repaired ${repairs.length} product(s)`)
  }
}
finally {
  await sql.end()
}
