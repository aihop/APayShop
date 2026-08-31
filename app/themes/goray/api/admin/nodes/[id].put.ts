import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { saveNode } from '../../../server/nodes/nodeService'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)
    const nodeId = getRouterParam(event, 'id')
    if (!nodeId) throw Errors.badRequest('Missing node ID')

    const body = await readBody(event)
    const protocol = body.protocol || 'vmess'

    await saveNode(
      nodeId,
      body.display_name,
      body.country_code,
      body.region,
      protocol,
      {
        server_addr: body.server_addr,
        server_port: Number(body.server_port),
        protocol,
        uuid: body.uuid,
        password: body.password,
        security: body.security,
        ws_path: body.ws_path,
        ws_host: body.ws_host,
        tls_enabled: body.tls_enabled !== false,
        sni: body.sni,
        utls_fingerprint: body.utls_fingerprint,
        obfs: body.obfs,
        obfs_password: body.obfs_password,
      },
      Number(body.weight || 100),
      Number(body.display_order || 0),
      body.status || 'online'
    )

    return successResponse({ id: nodeId, status: 'updated' }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
