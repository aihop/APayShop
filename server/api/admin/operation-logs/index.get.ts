import { operationLogs } from "../../../db/schema"
import { desc, count, sql } from "drizzle-orm"
import { db } from '../../../db/runtime'
import { toIsoTimestamp } from '../../../utils/dbTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const pageSize = Math.min(parseInt(query.pageSize as string) || 50, 200)
  const actorTypeFilter = typeof query.actorType === 'string' ? query.actorType.trim() : ''
  const actionFilter = typeof query.action === 'string' ? query.action.trim() : ''
  const resourceFilter = typeof query.resource === 'string' ? query.resource.trim() : ''
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const offset = (page - 1) * pageSize

  const conditions: any[] = []

  if (actorTypeFilter) {
    conditions.push(sql`${operationLogs.actorType} = ${actorTypeFilter}`)
  }
  if (actionFilter) {
    conditions.push(sql`${operationLogs.action} = ${actionFilter}`)
  }
  if (resourceFilter) {
    conditions.push(sql`${operationLogs.resource} = ${resourceFilter}`)
  }
  if (search) {
    conditions.push(sql`(
      ${operationLogs.actorName} LIKE ${`%${search}%`}
      OR ${operationLogs.resourceId} LIKE ${`%${search}%`}
      OR ${operationLogs.path} LIKE ${`%${search}%`}
      OR ${operationLogs.summary} LIKE ${`%${search}%`}
    )`)
  }

  const where = conditions.length > 0
    ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
    : undefined

  const countResult = where
    ? await db.select({ value: count() }).from(operationLogs).where(where)
    : await db.select({ value: count() }).from(operationLogs)
  const [{ value: total }] = countResult

  let queryBuilder = db.select({
    id: operationLogs.id,
    actorType: operationLogs.actorType,
    actorId: operationLogs.actorId,
    actorName: operationLogs.actorName,
    action: operationLogs.action,
    resource: operationLogs.resource,
    resourceId: operationLogs.resourceId,
    summary: operationLogs.summary,
    details: operationLogs.details,
    path: operationLogs.path,
    method: operationLogs.method,
    statusCode: operationLogs.statusCode,
    ip: operationLogs.ip,
    userAgent: operationLogs.userAgent,
    createdAt: operationLogs.createdAt,
  })
    .from(operationLogs)
    .orderBy(desc(operationLogs.createdAt), desc(operationLogs.id))
    .limit(pageSize)
    .offset(offset)

  if (where) {
    queryBuilder = queryBuilder.where(where) as any
  }

  const result = await queryBuilder

  const normalizedLogs = result.map((log: any) => ({
    ...log,
    createdAt: toIsoTimestamp(log.createdAt),
  }))

  // Populate the filter dropdowns from what has actually been recorded, so a
  // theme-added admin route shows up without touching this file.
  const [resources, actions] = await Promise.all([
    db.selectDistinct({ value: operationLogs.resource }).from(operationLogs),
    db.selectDistinct({ value: operationLogs.action }).from(operationLogs),
  ])

  return {
    logs: normalizedLogs,
    total,
    page,
    pageSize,
    facets: {
      resources: resources.map((r: any) => r.value).filter(Boolean).sort(),
      actions: actions.map((a: any) => a.value).filter(Boolean).sort(),
    },
  }
})
