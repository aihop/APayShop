import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const defaultLockDir = path.join(projectRoot, 'node_modules/.cache/nuxt/apay-build.lock')
const OWNER_FILE = 'owner.json'
const DEFAULT_WAIT_INTERVAL_MS = 1_000
const UNKNOWN_OWNER_STALE_MS = 12 * 60 * 60 * 1_000

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return error?.code === 'EPERM'
  }
}

const readOwner = async (lockDir) => {
  try {
    return JSON.parse(await readFile(path.join(lockDir, OWNER_FILE), 'utf8'))
  }
  catch {
    return null
  }
}

const canRemoveLock = async (lockDir, owner) => {
  if (owner && Number.isInteger(owner.pid)) return !isProcessAlive(owner.pid)
  try {
    const lockStat = await stat(lockDir)
    return Date.now() - lockStat.mtimeMs > UNKNOWN_OWNER_STALE_MS
  }
  catch {
    return false
  }
}

export async function acquireBuildLock(options = {}) {
  const lockDir = options.lockDir || defaultLockDir
  const waitIntervalMs = options.waitIntervalMs || DEFAULT_WAIT_INTERVAL_MS
  const token = randomUUID()
  let waitStartedAt = 0
  let lastNoticeAt = 0

  await mkdir(path.dirname(lockDir), { recursive: true })
  for (;;) {
    try {
      await mkdir(lockDir)
      await writeFile(path.join(lockDir, OWNER_FILE), JSON.stringify({
        token,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }, null, 2))
      break
    }
    catch (error) {
      if (error?.code !== 'EEXIST') throw error
      const owner = await readOwner(lockDir)
      if (await canRemoveLock(lockDir, owner)) {
        await rm(lockDir, { recursive: true, force: true })
        continue
      }
      const now = Date.now()
      waitStartedAt ||= now
      if (!lastNoticeAt || now - lastNoticeAt >= 10_000) {
        const ownerHint = owner?.pid ? `（PID ${owner.pid}）` : ''
        console.log(`[build] 检测到另一个 APay 生产构建${ownerHint}，等待其完成，避免 Nuxt 缓存互相清理…`)
        lastNoticeAt = now
      }
      await sleep(waitIntervalMs)
    }
  }

  if (waitStartedAt) {
    console.log(`[build] 已获得构建锁，等待 ${Math.ceil((Date.now() - waitStartedAt) / 1_000)} 秒`)
  }

  return async () => {
    const owner = await readOwner(lockDir)
    if (owner?.token === token) {
      await rm(lockDir, { recursive: true, force: true })
    }
  }
}
