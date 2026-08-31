import { defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'
import { requireApayAdmin } from '../../../server/shared/coreAdapter'
import { goraySql } from '../../../server/db/pg'
import { Errors, getRequestId, handleApiError, successResponse } from '../../../server/shared/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireApayAdmin(event)

    const body = await readBody(event)
    if (!body || !body.platform || !body.version || !body.build_number || !body.download_url || !body.sha256) {
      throw Errors.badRequest('Missing required release fields')
    }

    const id = randomUUID()
    const manifestPayload = Buffer.from(JSON.stringify({
      platform: body.platform,
      version: body.version,
      build_number: Number(body.build_number),
      download_url: body.download_url,
      sha256: body.sha256,
    }), 'utf8')

    await goraySql.begin(async (tx) => {
      // 如果设置为 published，先把同平台旧 published 改为 revoked
      if (body.status === 'published') {
        await tx`
          UPDATE goray_releases
          SET status = 'revoked'
          WHERE platform = ${body.platform} AND status = 'published'
        `
      }

      await tx`
        INSERT INTO goray_releases (
          id, platform, version, build_number, download_url,
          file_size_bytes, sha256, signing_key_id, manifest_payload,
          signature, status, released_at, published_at
        ) VALUES (
          ${id}, ${body.platform}, ${body.version}, ${Number(body.build_number)}, ${body.download_url},
          ${Number(body.file_size_bytes || 1024)}, ${body.sha256}, 'goray-ed25519-v1', ${manifestPayload},
          ${Buffer.from('sig_placeholder', 'utf8')}, ${body.status || 'published'}, NOW(), NOW()
        )
      `
    })

    return successResponse({ id, status: 'created' }, getRequestId(event))
  } catch (err: any) {
    return handleApiError(event, err)
  }
})
