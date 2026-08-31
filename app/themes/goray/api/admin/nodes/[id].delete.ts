import { defineEventHandler, getRouterParam } from 'h3'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)
    const nodeId = getRouterParam(event, 'id')
    if (!nodeId) throw Errors.badRequest('Missing node ID')

    await goraySql`
      DELETE FROM goray_nodes WHERE id = ${nodeId}
    `

    return successResponse({ id: nodeId, status: 'deleted' }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
