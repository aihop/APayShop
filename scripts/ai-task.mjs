#!/usr/bin/env node
// AI 任务契约脚本：契约校验、claims 文件租约、范围检查、验证报告与释放。
// 设计原则：范围只看 claims；验证与释放只关心 claims 内文件；不惩罚别人的工作。
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(workspaceRoot, '.tmp', 'ai-tasks')
const leaseDir = join(runtimeRoot, 'leases')
const reportDir = join(runtimeRoot, 'reports')
const leaseLockDir = join(runtimeRoot, 'lease-write.lock')
const DEFAULT_TTL_MINUTES = 480
// 这些工作区改动不算越界：其他会话登记的契约、脚本运行态、macOS 目录元数据
const FOREIGN_IGNORE_PATTERNS = ['.ai/tasks/**', '.tmp/**']

const fail = (message, code = 1) => {
  console.error(`✗ ${message}`)
  process.exit(code)
}
const warn = message => console.warn(`! ${message}`)

const parseArgs = (args) => {
  const values = { _: [] }
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      values._.push(token)
      continue
    }
    const key = token.slice(2)
    const next = args[index + 1]
    if (!next || next.startsWith('--')) values[key] = true
    else {
      values[key] = next
      index += 1
    }
  }
  return values
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const parseTtlMinutes = (raw) => {
  const requested = Number(raw || DEFAULT_TTL_MINUTES)
  if (!Number.isFinite(requested) || requested <= 0) fail('--ttl 必须是正数分钟')
  return Math.max(5, Math.ceil(requested))
}

const resolveContractPath = (rawPath) => {
  if (!rawPath) fail('缺少 --contract <任务契约.json>')
  return isAbsolute(rawPath) ? rawPath : resolve(workspaceRoot, rawPath)
}
const resolveRepoPath = (repo) => resolve(workspaceRoot, repo.path)
const gitRaw = (repoPath, args) => execFileSync('git', args, {
  cwd: repoPath,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const git = (repoPath, args) => gitRaw(repoPath, args).trim()

const withLeaseWriteLock = (action) => {
  mkdirSync(runtimeRoot, { recursive: true })
  if (existsSync(leaseLockDir) && Date.now() - statSync(leaseLockDir).mtimeMs > 5 * 60 * 1000) {
    rmSync(leaseLockDir, { recursive: true, force: true })
  }
  try {
    mkdirSync(leaseLockDir)
  } catch {
    fail('另一个 AI 正在更新任务租约，请稍后重试', 2)
  }
  const cleanup = () => rmSync(leaseLockDir, { recursive: true, force: true })
  process.once('exit', cleanup)
  try {
    return action()
  } finally {
    process.removeListener('exit', cleanup)
    cleanup()
  }
}

// ---- 路径模式：精确文件或以 /** 结尾的目录 ----
const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')
const validateRepoPattern = (pattern, label, errors) => {
  const normalized = normalizePath(pattern)
  const segments = normalized.replace(/\/\*\*$/, '').split('/')
  if (!normalized || isAbsolute(normalized) || segments.includes('..')) {
    errors.push(`${label} 必须是仓库内相对路径：${pattern || '(空)'}`)
  }
  if (/\*/.test(normalized.replace(/\/\*\*$/, ''))) {
    errors.push(`${label} 只支持精确路径或 /**：${pattern}`)
  }
}
const claimPrefix = (claim) => normalizePath(claim).replace(/\/\*\*$/, '')
const claimContains = (claim, path) => {
  const normalizedClaim = normalizePath(claim)
  const normalizedPath = normalizePath(path)
  if (normalizedClaim.endsWith('/**')) {
    const prefix = claimPrefix(normalizedClaim)
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  }
  return normalizedClaim === normalizedPath
}
const patternCovers = (outer, inner) => {
  const normalizedOuter = normalizePath(outer)
  const normalizedInner = normalizePath(inner)
  if (normalizedOuter.endsWith('/**')) return claimContains(normalizedOuter, claimPrefix(normalizedInner))
  return !normalizedInner.endsWith('/**') && normalizedOuter === normalizedInner
}
const claimsOverlap = (left, right) => claimContains(left, claimPrefix(right)) || claimContains(right, claimPrefix(left))
const inAny = (patterns, path) => (patterns || []).some(pattern => claimContains(pattern, path))
const isIgnoredForeignPath = (path) => basename(path) === '.DS_Store' || inAny(FOREIGN_IGNORE_PATTERNS, path)

// ---- Git 状态 ----
const parseStatusPaths = (output) => {
  const fields = output.split('\0').filter(Boolean)
  const paths = []
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]
    const status = field.slice(0, 2)
    const path = field.slice(3)
    if (path) paths.push(normalizePath(path))
    if (status.includes('R') || status.includes('C')) index += 1
  }
  return [...new Set(paths)]
}
const getRepoStatusPaths = (repoPath) => parseStatusPaths(gitRaw(repoPath, [
  'status', '--no-renames', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=dirty',
]))
// 工作区改动 + 基线之后的提交改动。越界只追究工作区改动；提交由各自的授权负责。
const collectRepoChanges = (repoPath, baseCommit) => {
  const status = getRepoStatusPaths(repoPath)
  let committed = []
  try {
    committed = git(repoPath, ['diff', '--no-renames', '--name-only', `${baseCommit}..HEAD`])
      .split('\n').map(normalizePath).filter(Boolean)
  } catch {
    warn(`无法比较 ${baseCommit.slice(0, 12)}..HEAD（基线提交可能已被重写），只按工作区状态判断`)
  }
  return { status, committed, changed: [...new Set([...committed, ...status])] }
}
// 只对 claims 内已变化的文件做摘要；finish 用它判断验证后是否又改过。
const buildScopeState = (repoPath, paths) => {
  const hash = createHash('sha256')
  const sorted = [...new Set(paths)].sort()
  for (const path of sorted) {
    const absolutePath = join(repoPath, path)
    hash.update(`PATH\0${path}\0`)
    if (!existsSync(absolutePath)) {
      hash.update('DELETED\0')
      continue
    }
    const stats = lstatSync(absolutePath)
    if (stats.isSymbolicLink()) hash.update(`SYMLINK\0${readlinkSync(absolutePath)}\0`)
    else if (stats.isFile()) hash.update(readFileSync(absolutePath))
    else if (stats.isDirectory() && existsSync(join(absolutePath, '.git'))) {
      hash.update(`SUBMODULE\0${git(absolutePath, ['rev-parse', 'HEAD'])}\0`)
    } else hash.update(`DIRECTORY\0${stats.mode}\0`)
  }
  return { paths: sorted, digest: hash.digest('hex') }
}

// ---- 契约 ----
const effectiveAllowedPaths = (repo) => (Array.isArray(repo.allowedPaths) && repo.allowedPaths.length ? repo.allowedPaths : repo.claims || [])
const checkAlwaysRuns = (check) => Boolean(check.always) || !Array.isArray(check.triggers) || check.triggers.length === 0

const validateContract = (contract, contractPath) => {
  const errors = []
  if (contract.schemaVersion !== 1) errors.push('schemaVersion 必须为 1')
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(String(contract.id || ''))) errors.push('id 必须为 3-64 位小写字母、数字或连字符')
  if (!String(contract.title || '').trim()) errors.push('缺少 title')
  for (const key of ['constraints', 'acceptanceCriteria']) {
    if (contract[key] !== undefined && (!Array.isArray(contract[key]) || contract[key].some(item => !String(item).trim()))) {
      errors.push(`${key} 若声明必须是非空字符串数组`)
    }
  }
  if (!Array.isArray(contract.repositories) || contract.repositories.length === 0) errors.push('repositories 不能为空')
  const names = new Set()
  const repoPaths = new Set()
  for (const repo of contract.repositories || []) {
    if (!repo.name || names.has(repo.name)) errors.push(`仓库名称缺失或重复：${repo.name || '(空)'}`)
    names.add(repo.name)
    if (!repo.path) errors.push(`${repo.name} 缺少 path`)
    const repoPath = resolveRepoPath({ path: repo.path || '.' })
    if (repoPaths.has(repoPath)) errors.push(`仓库路径重复：${repo.path}`)
    repoPaths.add(repoPath)
    if (!existsSync(join(repoPath, '.git'))) errors.push(`${repo.name} 不是可用 Git 仓库：${repoPath}`)
    if (!Array.isArray(repo.claims) || repo.claims.length === 0) errors.push(`${repo.name}.claims 不能为空`)
    for (const pattern of repo.claims || []) validateRepoPattern(pattern, `${repo.name}.claims`, errors)
    if (repo.allowedPaths !== undefined) {
      if (!Array.isArray(repo.allowedPaths)) errors.push(`${repo.name}.allowedPaths 若声明必须是数组`)
      for (const pattern of repo.allowedPaths || []) validateRepoPattern(pattern, `${repo.name}.allowedPaths`, errors)
      for (const claim of repo.claims || []) {
        if (!(repo.allowedPaths || []).some(allowed => patternCovers(allowed, claim))) {
          errors.push(`${repo.name} claim 不在 allowedPaths 内：${claim}`)
        }
      }
    }
  }
  if (!Array.isArray(contract.verification) || contract.verification.length === 0) errors.push('verification 不能为空')
  for (const check of contract.verification || []) {
    if (!check.name || !names.has(check.repository) || !check.command) errors.push(`验证项不完整：${JSON.stringify(check)}`)
    if (check.triggers !== undefined && !Array.isArray(check.triggers)) errors.push(`${check.name}.triggers 必须是数组`)
    for (const trigger of check.triggers || []) validateRepoPattern(trigger, `${check.name}.triggers`, errors)
  }
  for (const repo of contract.repositories || []) {
    if (!(contract.verification || []).some(check => check.repository === repo.name)) errors.push(`${repo.name} 没有任何验证项`)
  }
  if (errors.length) fail(`任务契约无效：\n  - ${errors.join('\n  - ')}`)
  console.log(`✓ 任务契约有效：${contract.id}（${relative(workspaceRoot, contractPath)}）`)
}

const readContract = (rawPath) => {
  const contractPath = resolveContractPath(rawPath)
  if (!existsSync(contractPath)) fail(`任务契约不存在：${contractPath}`)
  const contract = readJson(contractPath)
  validateContract(contract, contractPath)
  return { contract, contractPath, digest: sha256(readFileSync(contractPath)) }
}

// ---- 租约 ----
const leasePathFor = (taskId) => join(leaseDir, `${taskId}.json`)
const reportPathFor = (taskId) => join(reportDir, `${taskId}.json`)
const isExpired = (lease) => Number(lease?.expiresAt || 0) <= Date.now()
const readLeaseFile = (taskId) => (existsSync(leasePathFor(taskId)) ? readJson(leasePathFor(taskId)) : null)
const readActiveLeases = () => {
  mkdirSync(leaseDir, { recursive: true })
  return readdirSync(leaseDir).filter(name => name.endsWith('.json')).flatMap((name) => {
    const path = join(leaseDir, name)
    const lease = readJson(path)
    if (isExpired(lease)) {
      rmSync(path, { force: true })
      return []
    }
    return [lease]
  })
}
const requireOwnedLease = (contract, agent, verb) => {
  const lease = readLeaseFile(contract.id)
  if (!lease) fail(`任务 ${contract.id} 没有有效租约`)
  if (isExpired(lease)) {
    rmSync(leasePathFor(contract.id), { force: true })
    fail(`任务 ${contract.id} 的租约已过期，请 resume`, 2)
  }
  if (lease.agent !== agent) fail(`租约属于 ${lease.agent}，${agent || '(空)'} 无权${verb}`)
  return lease
}
const findClaimConflicts = (repoEntries, leases) => {
  const conflicts = []
  for (const lease of leases) {
    for (const repo of repoEntries) {
      const existingRepo = lease.repositories?.find(item => resolveRepoPath(item) === resolveRepoPath(repo))
      if (!existingRepo) continue
      for (const claim of repo.claims) {
        for (const existingClaim of existingRepo.claims || []) {
          if (claimsOverlap(claim, existingClaim)) {
            conflicts.push(`${repo.name}:${claim} ↔ ${lease.taskId}/${lease.agent}:${existingRepo.name}:${existingClaim}`)
          }
        }
      }
    }
  }
  return conflicts
}
const pathCoveredByOtherLease = (repo, path, otherLeases) => otherLeases.some(lease => (lease.repositories || [])
  .some(item => resolveRepoPath(item) === resolveRepoPath(repo) && inAny(item.claims, path)))
const snapshotRepo = (repo) => {
  const repoPath = resolveRepoPath(repo)
  return {
    name: repo.name,
    path: repo.path,
    head: git(repoPath, ['rev-parse', 'HEAD']),
    branch: git(repoPath, ['branch', '--show-current']),
    claims: repo.claims,
    allowedPaths: effectiveAllowedPaths(repo),
    preexistingChanges: getRepoStatusPaths(repoPath),
  }
}
const acceptedClaimChangesFor = (lease, repoName) => {
  const entries = [
    ...(lease?.resume?.acceptedClaimChanges || []),
    ...(lease?.extensions || []).flatMap(extension => extension.acceptedClaimChanges || []),
  ]
  return new Set(entries.filter(path => path.startsWith(`${repoName}:`)).map(path => path.slice(repoName.length + 1)))
}
const analyzeRepo = (repo, lease, otherLeases) => {
  const snapshot = lease.repositories.find(item => item.name === repo.name)
  if (!snapshot) fail(`租约里没有仓库 ${repo.name}；契约新增仓库后请先 extend`, 2)
  const repoPath = resolveRepoPath(repo)
  const { status, changed } = collectRepoChanges(repoPath, snapshot.head)
  const preexisting = new Set(snapshot.preexistingChanges || [])
  const accepted = acceptedClaimChangesFor(lease, repo.name)
  const scopePaths = changed.filter(path => inAny(repo.claims, path))
  return {
    repoPath,
    changed,
    scopePaths,
    taskChanged: scopePaths.filter(path => !preexisting.has(path) || accepted.has(path)),
    foreign: status.filter(path => !inAny(repo.claims, path) && !preexisting.has(path)
      && !isIgnoredForeignPath(path) && !pathCoveredByOtherLease(repo, path, otherLeases)),
  }
}
const claimedDirtyPaths = (repositories) => repositories.flatMap(repo => repo.preexistingChanges
  .filter(path => inAny(repo.claims, path))
  .map(path => `${repo.name}:${path}`))
const printLease = (lease) => {
  const remaining = Math.max(0, Math.round((lease.expiresAt - Date.now()) / 60000))
  console.log(`${lease.taskId} | ${lease.agent} | 剩余 ${remaining} 分钟（到期 ${new Date(lease.expiresAt).toISOString()}）`)
  for (const repo of lease.repositories || []) console.log(`  ${repo.name}: ${(repo.claims || []).join(', ')}`)
}

// ---- 命令 ----
const command = process.argv[2]
const args = parseArgs(process.argv.slice(3))

if (!command || command === 'help') {
  console.log(`用法：
  node scripts/ai-task.mjs validate --contract <path>
  node scripts/ai-task.mjs start    --contract <path> --agent <name> [--ttl ${DEFAULT_TTL_MINUTES}] [--dry-run]
  node scripts/ai-task.mjs verify   --contract <path> [--all] [--dry-run]
  node scripts/ai-task.mjs finish   --contract <path> --agent <name>
  node scripts/ai-task.mjs extend   --contract <path> --agent <name> [--confirm EXTEND:<task-id>]
  node scripts/ai-task.mjs renew    --contract <path> --agent <name> [--ttl ${DEFAULT_TTL_MINUTES}]
  node scripts/ai-task.mjs abort    --contract <path> --agent <name>
  node scripts/ai-task.mjs resume   --contract <path> --agent <name> --confirm RESUME:<task-id> [--ttl ${DEFAULT_TTL_MINUTES}]
  node scripts/ai-task.mjs status   [--task <id>] [--reports <n>]`)
  process.exit(0)
}

if (command === 'status') {
  const leases = readActiveLeases().filter(lease => !args.task || lease.taskId === args.task)
  if (!leases.length) console.log('当前没有匹配的有效 AI 开发租约')
  else for (const lease of leases) printLease(lease)
  if (args.reports) {
    mkdirSync(reportDir, { recursive: true })
    const reports = readdirSync(reportDir).filter(name => name.endsWith('.json'))
      .map(name => readJson(join(reportDir, name)))
      .filter(report => !args.task || report.taskId === args.task)
      .sort((left, right) => (right.checkedAt || 0) - (left.checkedAt || 0))
      .slice(0, Number(args.reports) || 10)
    console.log(reports.length ? '最近验证报告：' : '没有验证报告')
    for (const report of reports) {
      const state = report.success ? (report.finishedAt ? 'finished' : 'verified') : 'failed'
      console.log(`  ${report.taskId} | ${state} | ${new Date(report.checkedAt).toISOString()}`)
    }
  }
  process.exit(0)
}

const { contract, contractPath, digest } = readContract(args.contract)

if (command === 'validate') process.exit(0)

if (command === 'start') {
  const agent = String(args.agent || '').trim()
  if (!agent) fail('start 缺少 --agent <name>')
  withLeaseWriteLock(() => {
    const activeLeases = readActiveLeases()
    const sameTaskLease = activeLeases.find(lease => lease.taskId === contract.id)
    if (sameTaskLease) {
      const owner = sameTaskLease.agent === agent ? `${agent} 持有有效租约，不能重置开工基线` : `已被 ${sameTaskLease.agent} 占用`
      fail(`任务 ${contract.id} ${owner}`, 2)
    }
    const conflicts = findClaimConflicts(contract.repositories, activeLeases)
    if (conflicts.length) fail(`文件租约冲突：\n  - ${conflicts.join('\n  - ')}`, 2)
    const repositories = contract.repositories.map(snapshotRepo)
    const dirty = claimedDirtyPaths(repositories)
    if (dirty.length) fail(`以下租约路径已有未提交改动，不能安全开工（若是本任务上次中断的现场请 resume）：\n  - ${dirty.join('\n  - ')}`, 2)
    const ttlMinutes = parseTtlMinutes(args.ttl)
    const lease = {
      schemaVersion: 1,
      taskId: contract.id,
      title: contract.title,
      contractPath: relative(workspaceRoot, contractPath),
      contractDigest: digest,
      agent,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      repositories,
    }
    if (args['dry-run']) {
      console.log(JSON.stringify(lease, null, 2))
      return
    }
    rmSync(reportPathFor(contract.id), { force: true })
    writeJson(leasePathFor(contract.id), lease)
    console.log(`✓ 已创建任务租约：${contract.id}（${agent}，${ttlMinutes} 分钟）`)
  })
  process.exit(0)
}

if (command === 'resume') {
  const agent = String(args.agent || '').trim()
  const confirmation = String(args.confirm || '').trim()
  const expectedConfirmation = `RESUME:${contract.id}`
  if (!agent) fail('resume 缺少 --agent <name>')
  if (confirmation !== expectedConfirmation) fail(`resume 需要精确确认串：--confirm ${expectedConfirmation}`, 2)
  withLeaseWriteLock(() => {
    const activeLeases = readActiveLeases()
    const sameTaskLease = activeLeases.find(lease => lease.taskId === contract.id)
    if (sameTaskLease) fail(`任务 ${contract.id} 已由 ${sameTaskLease.agent} 持有有效租约，不能 resume`, 2)
    const conflicts = findClaimConflicts(contract.repositories, activeLeases)
    if (conflicts.length) fail(`文件租约冲突：\n  - ${conflicts.join('\n  - ')}`, 2)
    const repositories = contract.repositories.map(snapshotRepo)
    const acceptedClaimChanges = claimedDirtyPaths(repositories)
    const ttlMinutes = parseTtlMinutes(args.ttl)
    const lease = {
      schemaVersion: 1,
      taskId: contract.id,
      title: contract.title,
      contractPath: relative(workspaceRoot, contractPath),
      contractDigest: digest,
      agent,
      createdAt: Date.now(),
      resumedAt: Date.now(),
      resumeConfirmation: confirmation,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      repositories,
      resume: {
        acceptedClaimChanges,
        preservedPreexistingChanges: repositories.flatMap(repo => repo.preexistingChanges
          .filter(path => !inAny(repo.claims, path))
          .map(path => `${repo.name}:${path}`)),
      },
    }
    if (args['dry-run']) {
      console.log(JSON.stringify(lease, null, 2))
      return
    }
    rmSync(reportPathFor(contract.id), { force: true })
    writeJson(leasePathFor(contract.id), lease)
    console.log(`✓ 已恢复任务租约：${contract.id}（${agent}，${ttlMinutes} 分钟；已接纳 ${acceptedClaimChanges.length} 个 claims 现场改动）`)
  })
  process.exit(0)
}

if (command === 'extend') {
  const agent = String(args.agent || '').trim()
  const confirmation = String(args.confirm || '').trim()
  const expectedConfirmation = `EXTEND:${contract.id}`
  if (!agent) fail('extend 缺少 --agent <name>')
  withLeaseWriteLock(() => {
    const lease = requireOwnedLease(contract, agent, '扩围')
    const otherLeases = readActiveLeases().filter(item => item.taskId !== contract.id)
    const added = []
    const beyondBudget = []
    const acceptedClaimChanges = []
    const newClaimEntries = []
    for (const leased of lease.repositories) {
      if (!contract.repositories.some(repo => repo.name === leased.name)) {
        fail(`不能在活动租约上移除仓库 ${leased.name}；放弃任务请 abort`, 2)
      }
    }
    const repositories = contract.repositories.map((repo) => {
      const existing = lease.repositories.find(item => item.name === repo.name)
      if (!existing) {
        // 契约新增仓库：现在建立基线，全部 claims 视为超出原预算的新增
        const snapshot = snapshotRepo(repo)
        for (const claim of repo.claims) {
          added.push(`${repo.name}:${claim}`)
          beyondBudget.push(`${repo.name}:${claim}`)
        }
        newClaimEntries.push({ name: repo.name, path: repo.path, claims: repo.claims })
        acceptedClaimChanges.push(...claimedDirtyPaths([snapshot]))
        return snapshot
      }
      const removed = (existing.claims || []).filter(claim => !repo.claims.some(next => patternCovers(next, claim)))
      if (removed.length) fail(`不能在活动租约上缩减 claims（${repo.name}: ${removed.join(', ')}）；放弃任务请 abort`, 2)
      const newClaims = repo.claims.filter(claim => !(existing.claims || []).some(previous => patternCovers(previous, claim)))
      for (const claim of newClaims) {
        added.push(`${repo.name}:${claim}`)
        if (!(existing.allowedPaths || []).some(allowed => patternCovers(allowed, claim))) beyondBudget.push(`${repo.name}:${claim}`)
      }
      if (newClaims.length) newClaimEntries.push({ name: repo.name, path: repo.path, claims: newClaims })
      const preexisting = new Set(existing.preexistingChanges || [])
      for (const path of getRepoStatusPaths(resolveRepoPath(repo))) {
        if (inAny(newClaims, path) && !preexisting.has(path)) acceptedClaimChanges.push(`${repo.name}:${path}`)
      }
      return { ...existing, claims: repo.claims, allowedPaths: effectiveAllowedPaths(repo) }
    })
    if (!added.length) fail('契约 claims 与租约一致，无需扩围')
    if (beyondBudget.length && confirmation !== expectedConfirmation) {
      fail(`以下新增 claims 超出契约预先批准的 allowedPaths，需用户确认后附 --confirm ${expectedConfirmation}：\n  - ${beyondBudget.join('\n  - ')}`, 2)
    }
    const conflicts = findClaimConflicts(newClaimEntries, otherLeases)
    if (conflicts.length) fail(`文件租约冲突：\n  - ${conflicts.join('\n  - ')}`, 2)
    const updated = {
      ...lease,
      contractDigest: digest,
      repositories,
      extensions: [...(lease.extensions || []), {
        at: Date.now(),
        agent,
        added,
        acceptedClaimChanges,
        userConfirmed: beyondBudget.length > 0,
      }],
    }
    rmSync(reportPathFor(contract.id), { force: true })
    writeJson(leasePathFor(contract.id), updated)
    const basis = beyondBudget.length ? '用户确认' : 'allowedPaths 预算内'
    console.log(`✓ 已扩围：新增 ${added.length} 个 claims（${basis}），接纳 ${acceptedClaimChanges.length} 个现场改动；旧验证报告已失效，请重新 verify`)
  })
  process.exit(0)
}

if (command === 'renew') {
  const agent = String(args.agent || '').trim()
  if (!agent) fail('renew 缺少 --agent <name>')
  withLeaseWriteLock(() => {
    const lease = requireOwnedLease(contract, agent, '续租')
    const ttlMinutes = parseTtlMinutes(args.ttl)
    lease.expiresAt = Date.now() + ttlMinutes * 60 * 1000
    lease.renewals = [...(lease.renewals || []), { at: Date.now(), ttlMinutes }]
    writeJson(leasePathFor(contract.id), lease)
    console.log(`✓ 已续租：${contract.id}（${ttlMinutes} 分钟，到期 ${new Date(lease.expiresAt).toISOString()}）`)
  })
  process.exit(0)
}

if (command === 'abort') {
  const agent = String(args.agent || '').trim()
  if (!agent) fail('abort 缺少 --agent <name>')
  withLeaseWriteLock(() => {
    const lease = readLeaseFile(contract.id)
    if (!lease) fail(`任务 ${contract.id} 没有有效租约`)
    if (!isExpired(lease) && lease.agent !== agent) fail(`租约属于 ${lease.agent}，${agent} 无权放弃`)
    rmSync(leasePathFor(contract.id), { force: true })
    rmSync(reportPathFor(contract.id), { force: true })
    console.log(`✓ 已放弃任务 ${contract.id} 的租约；工作区改动原样保留，请自行处置`)
  })
  process.exit(0)
}

if (command === 'verify') {
  const lease = readLeaseFile(contract.id)
  if (!lease && !args['dry-run']) fail(`任务 ${contract.id} 没有有效租约，请先 start`)
  if (lease && isExpired(lease)) {
    rmSync(leasePathFor(contract.id), { force: true })
    fail(`任务 ${contract.id} 的租约已过期，请 resume`, 2)
  }
  if (lease && lease.contractDigest !== digest) {
    fail(`任务 ${contract.id} 的契约在 start 后发生变化；补充 claims 请执行 extend，否则请恢复原契约`, 2)
  }
  const otherLeases = readActiveLeases().filter(item => item.taskId !== contract.id)
  const analyses = new Map()
  for (const repo of contract.repositories) {
    if (!lease) {
      analyses.set(repo.name, { repoPath: resolveRepoPath(repo), changed: [], scopePaths: [], taskChanged: [], foreign: [] })
      continue
    }
    const analysis = analyzeRepo(repo, lease, otherLeases)
    if (analysis.foreign.length) {
      fail(`发现租约外的工作区改动：\n  - ${analysis.foreign.map(path => `${repo.name}:${path}`).join('\n  - ')}\n`
        + '  若属于本任务，请在契约 claims 中补上后执行 extend；若属于其他会话，请对方 prepare 取得租约或改用独立 worktree', 2)
    }
    analyses.set(repo.name, analysis)
  }
  if (!args['dry-run'] && ![...analyses.values()].some(analysis => analysis.taskChanged.length > 0)) {
    fail('任务没有产生 claims 范围内的实际改动，不能生成成功验证报告', 2)
  }

  const checks = contract.verification.filter(check => args.all || checkAlwaysRuns(check)
    || analyses.get(check.repository)?.changed.some(path => inAny(check.triggers, path)))
  if (!checks.length) console.log('没有命中需要执行的验证项')
  const results = []
  for (const check of checks) {
    const repo = contract.repositories.find(item => item.name === check.repository)
    console.log(`${args['dry-run'] ? '○' : '▶'} [${check.repository}] ${check.name}: ${check.command}`)
    if (args['dry-run']) continue
    const startedAt = Date.now()
    const result = spawnSync(check.command, { cwd: resolveRepoPath(repo), shell: true, stdio: 'inherit', env: process.env })
    results.push({ name: check.name, repository: check.repository, command: check.command, exitCode: result.status, durationMs: Date.now() - startedAt })
    if (result.status !== 0) {
      writeJson(reportPathFor(contract.id), { taskId: contract.id, success: false, checkedAt: Date.now(), results })
      fail(`验证失败：${check.name}`)
    }
  }
  if (!args['dry-run']) {
    writeJson(reportPathFor(contract.id), {
      taskId: contract.id,
      success: true,
      checkedAt: Date.now(),
      contractDigest: digest,
      acceptanceCriteria: contract.acceptanceCriteria || [],
      changedByRepo: Object.fromEntries([...analyses].map(([name, analysis]) => [name, analysis.changed])),
      taskChangedByRepo: Object.fromEntries([...analyses].map(([name, analysis]) => [name, analysis.taskChanged])),
      scopeStates: Object.fromEntries([...analyses].map(([name, analysis]) => [name, buildScopeState(analysis.repoPath, analysis.scopePaths)])),
      results,
    })
    console.log(`✓ 验证完成，报告：${relative(workspaceRoot, reportPathFor(contract.id))}`)
  }
  process.exit(0)
}

if (command === 'finish') {
  const agent = String(args.agent || '').trim()
  withLeaseWriteLock(() => {
    const lease = requireOwnedLease(contract, agent, '释放')
    if (lease.contractDigest !== digest) fail('任务契约在 start 后发生变化；补充 claims 请执行 extend 后重新 verify，否则请恢复原契约')
    const reportPath = reportPathFor(contract.id)
    const report = existsSync(reportPath) ? readJson(reportPath) : null
    if (!report?.success) fail('尚无成功验证报告，不能 finish')
    if (report.contractDigest !== digest) fail('任务契约在验证后发生变化，请重新 verify')
    if (!report.scopeStates) fail('验证报告是旧格式，请重新 verify')
    const changedAfterVerification = contract.repositories.flatMap((repo) => {
      const snapshot = lease.repositories.find(item => item.name === repo.name)
      if (!snapshot) return [repo.name]
      const repoPath = resolveRepoPath(repo)
      const { changed } = collectRepoChanges(repoPath, snapshot.head)
      const current = buildScopeState(repoPath, changed.filter(path => inAny(repo.claims, path)))
      return current.digest === report.scopeStates[repo.name]?.digest ? [] : [repo.name]
    })
    if (changedAfterVerification.length) fail(`以下仓库 claims 内文件在验证后又发生变化，请重新 verify：${changedAfterVerification.join('、')}`)
    writeJson(reportPath, { ...report, finishedAt: Date.now(), finishedBy: agent })
    rmSync(leasePathFor(contract.id), { force: true })
    console.log(`✓ 任务租约已释放：${contract.id}；验证报告保留在 ${relative(workspaceRoot, reportPath)}`)
  })
  process.exit(0)
}

fail(`未知命令：${command}`)
