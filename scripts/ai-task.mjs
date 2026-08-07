#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = join(workspaceRoot, '.tmp', 'ai-tasks')
const leaseDir = join(runtimeRoot, 'leases')
const reportDir = join(runtimeRoot, 'reports')
const leaseLockDir = join(runtimeRoot, 'lease-write.lock')

const fail = (message, code = 1) => {
  console.error(`✗ ${message}`)
  process.exit(code)
}

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
const claimsOverlap = (left, right) => {
  const leftPrefix = claimPrefix(left)
  const rightPrefix = claimPrefix(right)
  return claimContains(left, rightPrefix) || claimContains(right, leftPrefix)
}

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
  'status',
  '--no-renames',
  '--porcelain=v1',
  '-z',
  '--untracked-files=all',
  '--ignore-submodules=dirty',
]))
const getChangedPaths = (repoPath, baseCommit) => {
  const committed = git(repoPath, ['diff', '--no-renames', '--name-only', `${baseCommit}..HEAD`])
    .split('\n').map(normalizePath).filter(Boolean)
  return [...new Set([...committed, ...getRepoStatusPaths(repoPath)])]
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const buildRepoState = (repoPath, baseCommit) => {
  const hash = createHash('sha256')
  const changedPaths = getChangedPaths(repoPath, baseCommit).sort()
  hash.update(`HEAD\0${git(repoPath, ['rev-parse', 'HEAD'])}\0`)
  hash.update(`STATUS\0${gitRaw(repoPath, ['status', '--no-renames', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=dirty'])}\0`)
  for (const path of changedPaths) {
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
  return { changedPaths, digest: hash.digest('hex') }
}

const validateContract = (contract, contractPath) => {
  const errors = []
  if (contract.schemaVersion !== 1) errors.push('schemaVersion 必须为 1')
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(String(contract.id || ''))) errors.push('id 必须为 3-64 位小写字母、数字或连字符')
  for (const key of ['title', 'problem', 'expectedOutcome']) {
    if (!String(contract[key] || '').trim()) errors.push(`缺少 ${key}`)
  }
  if (!Array.isArray(contract.repositories) || contract.repositories.length === 0) errors.push('repositories 不能为空')
  const names = new Set()
  const repoPaths = new Set()
  for (const repo of contract.repositories || []) {
    if (!repo.name || names.has(repo.name)) errors.push(`仓库名称缺失或重复：${repo.name || '(空)'}`)
    names.add(repo.name)
    const repoPath = resolveRepoPath(repo)
    if (repoPaths.has(repoPath)) errors.push(`仓库路径重复：${repo.path}`)
    repoPaths.add(repoPath)
    if (!existsSync(join(repoPath, '.git'))) errors.push(`${repo.name} 不是可用 Git 仓库：${repoPath}`)
    for (const key of ['allowedPaths', 'claims']) {
      if (!Array.isArray(repo[key]) || repo[key].length === 0) errors.push(`${repo.name}.${key} 不能为空`)
      for (const pattern of repo[key] || []) {
        validateRepoPattern(pattern, `${repo.name}.${key}`, errors)
      }
    }
    for (const claim of repo.claims || []) {
      if (!(repo.allowedPaths || []).some(allowed => patternCovers(allowed, claim))) {
        errors.push(`${repo.name} claim 不在 allowedPaths 内：${claim}`)
      }
    }
  }
  if (!Array.isArray(contract.verification) || contract.verification.length === 0) errors.push('verification 不能为空')
  for (const check of contract.verification || []) {
    if (!check.name || !names.has(check.repository) || !check.command) errors.push(`验证项不完整：${JSON.stringify(check)}`)
    if (!check.always && (!Array.isArray(check.triggers) || check.triggers.length === 0)) errors.push(`验证项缺少 triggers：${check.name}`)
    for (const trigger of check.triggers || []) validateRepoPattern(trigger, `${check.name}.triggers`, errors)
  }
  for (const repo of contract.repositories || []) {
    for (const claim of repo.claims || []) {
      const covered = (contract.verification || []).some(check => check.repository === repo.name
        && (check.always || (check.triggers || []).some(trigger => patternCovers(trigger, claim))))
      if (!covered) errors.push(`${repo.name} claim 没有验证项完整覆盖：${claim}`)
    }
  }
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0 || contract.acceptanceCriteria.some(item => !String(item).trim())) {
    errors.push('acceptanceCriteria 必须包含非空验收标准')
  }
  if (errors.length) fail(`任务契约无效：\n  - ${errors.join('\n  - ')}`)
  console.log(`✓ 任务契约有效：${contract.id}（${relative(workspaceRoot, contractPath)}）`)
}

const readContract = (rawPath) => {
  const contractPath = resolveContractPath(rawPath)
  if (!existsSync(contractPath)) fail(`任务契约不存在：${contractPath}`)
  const contract = readJson(contractPath)
  validateContract(contract, contractPath)
  return { contract, contractPath }
}

const leasePathFor = (taskId) => join(leaseDir, `${taskId}.json`)
const reportPathFor = (taskId) => join(reportDir, `${taskId}.json`)
const readActiveLeases = () => {
  mkdirSync(leaseDir, { recursive: true })
  const now = Date.now()
  return readdirSync(leaseDir).filter(name => name.endsWith('.json')).flatMap((name) => {
    const path = join(leaseDir, name)
    const lease = readJson(path)
    if (Number(lease.expiresAt || 0) <= now) {
      rmSync(path, { force: true })
      return []
    }
    return [lease]
  })
}

const findLeaseConflicts = (contract, leases) => {
  const conflicts = []
  for (const lease of leases) {
    if (lease.taskId === contract.id) continue
    for (const repo of contract.repositories) {
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

const buildSnapshot = (contract) => contract.repositories.map((repo) => {
  const repoPath = resolveRepoPath(repo)
  return {
    name: repo.name,
    path: repo.path,
    head: git(repoPath, ['rev-parse', 'HEAD']),
    branch: git(repoPath, ['branch', '--show-current']),
    claims: repo.claims,
    allowedPaths: repo.allowedPaths,
    preexistingChanges: getRepoStatusPaths(repoPath),
  }
})

const assertNoClaimedDirtyPaths = (repositories) => {
  const conflicts = repositories.flatMap(repo => repo.preexistingChanges
    .filter(path => repo.claims.some(claim => claimContains(claim, path)))
    .map(path => `${repo.name}:${path}`))
  if (conflicts.length) fail(`以下租约路径已有未提交改动，不能安全开工：\n  - ${conflicts.join('\n  - ')}`, 2)
}

const command = process.argv[2]
const args = parseArgs(process.argv.slice(3))

if (!command || command === 'help') {
  console.log(`用法：
  node scripts/ai-task.mjs validate --contract <path>
  node scripts/ai-task.mjs start --contract <path> --agent <name> [--ttl 120] [--dry-run]
  node scripts/ai-task.mjs status [--task <id>]
  node scripts/ai-task.mjs verify --contract <path> [--all] [--dry-run]
  node scripts/ai-task.mjs finish --contract <path> --agent <name>`)
  process.exit(0)
}

if (command === 'validate') {
  readContract(args.contract)
  process.exit(0)
}

if (command === 'status') {
  const leases = readActiveLeases().filter(lease => !args.task || lease.taskId === args.task)
  if (!leases.length) console.log('当前没有匹配的有效 AI 开发租约')
  else for (const lease of leases) {
    console.log(`${lease.taskId} | ${lease.agent} | 到期 ${new Date(lease.expiresAt).toISOString()}`)
    for (const repo of lease.repositories || []) console.log(`  ${repo.name}: ${(repo.claims || []).join(', ')}`)
  }
  process.exit(0)
}

const { contract, contractPath } = readContract(args.contract)

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
    const conflicts = findLeaseConflicts(contract, activeLeases)
    if (conflicts.length) fail(`文件租约冲突：\n  - ${conflicts.join('\n  - ')}`, 2)
    const repositories = buildSnapshot(contract)
    assertNoClaimedDirtyPaths(repositories)
    const requestedTtl = Number(args.ttl || 120)
    if (!Number.isFinite(requestedTtl) || requestedTtl <= 0) fail('--ttl 必须是正数分钟')
    const ttlMinutes = Math.max(5, Math.ceil(requestedTtl))
    const lease = {
      schemaVersion: 1,
      taskId: contract.id,
      title: contract.title,
      contractPath: relative(workspaceRoot, contractPath),
      contractDigest: sha256(readFileSync(contractPath)),
      agent,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      repositories,
    }
    if (args['dry-run']) console.log(JSON.stringify(lease, null, 2))
    else {
      rmSync(reportPathFor(contract.id), { force: true })
      writeJson(leasePathFor(contract.id), lease)
      console.log(`✓ 已创建任务租约：${contract.id}（${agent}，${ttlMinutes} 分钟）`)
    }
  })
  process.exit(0)
}

if (command === 'verify') {
  const leasePath = leasePathFor(contract.id)
  const lease = existsSync(leasePath) ? readJson(leasePath) : null
  if (!lease && !args['dry-run']) fail(`任务 ${contract.id} 没有有效租约，请先 start`)
  if (lease && Number(lease.expiresAt || 0) <= Date.now()) {
    rmSync(leasePath, { force: true })
    fail(`任务 ${contract.id} 的租约已过期，请重新 start`, 2)
  }
  if (lease && lease.contractDigest !== sha256(readFileSync(contractPath))) {
    fail(`任务 ${contract.id} 的契约在 start 后发生变化，请恢复原契约或重新 start`, 2)
  }
  const changedByRepo = new Map()
  const taskChangedByRepo = new Map()
  for (const repo of contract.repositories) {
    const snapshot = lease?.repositories?.find(item => item.name === repo.name)
    const changed = snapshot ? getChangedPaths(resolveRepoPath(repo), snapshot.head) : []
    changedByRepo.set(repo.name, changed)
    if (snapshot) {
      taskChangedByRepo.set(repo.name, changed.filter(path =>
        repo.claims.some(claim => claimContains(claim, path))
        && !snapshot.preexistingChanges.includes(path)))
      const newlyOutOfScope = changed.filter(path =>
        !repo.allowedPaths.some(allowed => claimContains(allowed, path))
        && !snapshot.preexistingChanges.includes(path))
      if (newlyOutOfScope.length) fail(`发现契约范围外改动：\n  - ${newlyOutOfScope.map(path => `${repo.name}:${path}`).join('\n  - ')}`, 2)
      const newlyUnclaimed = changed.filter(path =>
        repo.allowedPaths.some(allowed => claimContains(allowed, path))
        && !repo.claims.some(claim => claimContains(claim, path))
        && !snapshot.preexistingChanges.includes(path))
      if (newlyUnclaimed.length) fail(`发现未取得文件租约的改动：\n  - ${newlyUnclaimed.map(path => `${repo.name}:${path}`).join('\n  - ')}`, 2)
    }
  }
  if (!args['dry-run'] && ![...taskChangedByRepo.values()].some(paths => paths.length > 0)) {
    fail('任务没有产生 claims 范围内的实际改动，不能生成成功验证报告', 2)
  }

  const checks = contract.verification.filter(check => args.all || check.always
    || changedByRepo.get(check.repository)?.some(path => check.triggers.some(trigger => claimContains(trigger, path))))
  if (!checks.length) console.log('没有命中需要执行的验证项')
  const results = []
  for (const check of checks) {
    const repo = contract.repositories.find(item => item.name === check.repository)
    console.log(`${args['dry-run'] ? '○' : '▶'} [${check.repository}] ${check.name}: ${check.command}`)
    if (args['dry-run']) continue
    const startedAt = Date.now()
    const result = spawnSync(check.command, {
      cwd: resolveRepoPath(repo),
      shell: true,
      stdio: 'inherit',
      env: process.env,
    })
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
      contractDigest: sha256(readFileSync(contractPath)),
      acceptanceCriteria: contract.acceptanceCriteria,
      changedByRepo: Object.fromEntries(changedByRepo),
      repositoryStates: Object.fromEntries(contract.repositories.map((repo) => {
        const snapshot = lease.repositories.find(item => item.name === repo.name)
        return [repo.name, buildRepoState(resolveRepoPath(repo), snapshot.head)]
      })),
      results,
    })
    console.log(`✓ 验证完成，报告：${relative(workspaceRoot, reportPathFor(contract.id))}`)
  }
  process.exit(0)
}

if (command === 'finish') {
  const agent = String(args.agent || '').trim()
  withLeaseWriteLock(() => {
    const leasePath = leasePathFor(contract.id)
    if (!existsSync(leasePath)) fail(`任务 ${contract.id} 没有有效租约`)
    const lease = readJson(leasePath)
    if (Number(lease.expiresAt || 0) <= Date.now()) {
      rmSync(leasePath, { force: true })
      fail(`任务 ${contract.id} 的租约已过期，请重新 start`, 2)
    }
    if (lease.contractDigest !== sha256(readFileSync(contractPath))) fail('任务契约在 start 后发生变化，请恢复原契约或重新 start')
    if (lease.agent !== agent) fail(`租约属于 ${lease.agent}，${agent || '(空)'} 无权释放`)
    const reportPath = reportPathFor(contract.id)
    const report = existsSync(reportPath) ? readJson(reportPath) : null
    if (!report?.success) fail('尚无成功验证报告，不能 finish')
    if (report.contractDigest !== sha256(readFileSync(contractPath))) fail('任务契约在验证后发生变化，请重新 verify')
    const changedAfterVerification = contract.repositories.flatMap((repo) => {
      const snapshot = lease.repositories.find(item => item.name === repo.name)
      const current = buildRepoState(resolveRepoPath(repo), snapshot.head)
      return current.digest === report.repositoryStates?.[repo.name]?.digest ? [] : [repo.name]
    })
    if (changedAfterVerification.length) fail(`以下仓库在验证后又发生变化，请重新 verify：${changedAfterVerification.join('、')}`)
    rmSync(leasePath, { force: true })
    console.log(`✓ 任务租约已释放：${contract.id}；验证报告保留在 ${relative(workspaceRoot, reportPath)}`)
  })
  process.exit(0)
}

fail(`未知命令：${command}`)
