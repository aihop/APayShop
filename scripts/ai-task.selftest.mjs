#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const workspaceRoot = resolve(import.meta.dirname, '..')
const cliPath = join(workspaceRoot, 'scripts', 'ai-task.mjs')
const flowPath = join(workspaceRoot, 'scripts', 'ai-task-flow.mjs')
const fixtureRoot = mkdtempSync(join(tmpdir(), 'apay-ai-task-selftest-'))
const repoPath = join(fixtureRoot, 'repo')
const contractPath = join(fixtureRoot, 'contract.json')
const conflictContractPath = join(fixtureRoot, 'conflict.json')
const invalidContractPath = join(fixtureRoot, 'invalid.json')
const taskId = `ai-task-selftest-${process.pid}`
const conflictTaskId = `${taskId}-conflict`
const expiredTaskId = `${taskId}-expired`
const runtimeRoot = join(workspaceRoot, '.tmp', 'ai-tasks')

const run = (args, options = {}) => spawnSync(process.execPath, [cliPath, ...args], {
  cwd: workspaceRoot,
  encoding: 'utf8',
  stdio: options.stdio || 'pipe',
})
const runFlow = (args, options = {}) => spawnSync(process.execPath, [flowPath, ...args], {
  cwd: workspaceRoot,
  encoding: 'utf8',
  stdio: options.stdio || 'pipe',
})
const expectSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label} 失败：${result.stderr || result.stdout}`)
}

try {
  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'ai-task@example.test'], { cwd: repoPath })
  execFileSync('git', ['config', 'user.name', 'AI Task Selftest'], { cwd: repoPath })
  writeFileSync(join(repoPath, 'allowed.txt'), 'before\n')
  execFileSync('git', ['add', 'allowed.txt'], { cwd: repoPath })
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repoPath, stdio: 'ignore' })

  const contract = {
    schemaVersion: 1,
    id: taskId,
    title: 'AI 任务流程端到端自测',
    problem: '需要验证任务契约、租约、范围和验证报告闭环',
    expectedOutcome: '合法改动完成验证后才能释放租约',
    repositories: [{
      name: 'fixture',
      path: repoPath,
      allowedPaths: ['allowed.txt', 'unclaimed.txt'],
      claims: ['allowed.txt'],
    }],
    acceptanceCriteria: ['allowed.txt 验证通过'],
    verification: [{
      name: '内容合同',
      repository: 'fixture',
      triggers: ['allowed.txt'],
      command: `${process.execPath} -e "const fs=require('fs');if(!fs.readFileSync('allowed.txt','utf8').includes('after'))process.exit(1)"`,
    }],
  }
  const contractSource = `${JSON.stringify(contract, null, 2)}\n`
  writeFileSync(contractPath, contractSource)
  writeFileSync(conflictContractPath, `${JSON.stringify({
    ...contract,
    id: conflictTaskId,
    repositories: contract.repositories.map(repo => ({ ...repo, name: 'fixture-alias' })),
    verification: contract.verification.map(check => ({ ...check, repository: 'fixture-alias' })),
  }, null, 2)}\n`)
  writeFileSync(invalidContractPath, `${JSON.stringify({
    ...contract,
    id: `${taskId}-invalid`,
    repositories: contract.repositories.map(repo => ({
      ...repo,
      allowedPaths: ['allowed.txt'],
      claims: ['allowed.txt/**'],
    })),
  }, null, 2)}\n`)

  expectSuccess(run(['validate', '--contract', contractPath]), 'validate')
  const invalidContract = run(['validate', '--contract', invalidContractPath])
  if (invalidContract.status === 0 || !invalidContract.stderr.includes('claim 不在 allowedPaths 内')) {
    throw new Error(`精确白名单错误接受目录租约：${invalidContract.stderr || invalidContract.stdout}`)
  }
  expectSuccess(runFlow(['prepare', '--contract', contractPath, '--agent', 'selftest-ai']), 'prepare')

  const noChanges = run(['verify', '--contract', contractPath])
  if (noChanges.status !== 2 || !noChanges.stderr.includes('没有产生 claims 范围内的实际改动')) {
    throw new Error(`无实际改动仍可验证成功：${noChanges.stderr || noChanges.stdout}`)
  }

  const repeatedStart = run(['start', '--contract', contractPath, '--agent', 'selftest-ai'])
  if (repeatedStart.status !== 2 || !repeatedStart.stderr.includes('不能重置开工基线')) {
    throw new Error(`重复 start 可重置开工基线：${repeatedStart.stderr || repeatedStart.stdout}`)
  }

  const sameTaskConflict = run(['start', '--contract', contractPath, '--agent', 'other-ai'])
  if (sameTaskConflict.status !== 2 || !sameTaskConflict.stderr.includes('已被 selftest-ai 占用')) {
    throw new Error(`同任务租约未被正确阻断：${sameTaskConflict.stderr || sameTaskConflict.stdout}`)
  }

  const finishWithoutReport = run(['finish', '--contract', contractPath, '--agent', 'selftest-ai'])
  if (finishWithoutReport.status === 0 || !finishWithoutReport.stderr.includes('尚无成功验证报告')) {
    throw new Error(`无验证报告仍可 finish：${finishWithoutReport.stderr || finishWithoutReport.stdout}`)
  }

  const conflict = run(['start', '--contract', conflictContractPath, '--agent', 'other-ai'])
  if (conflict.status !== 2 || !conflict.stderr.includes('文件租约冲突')) {
    throw new Error(`重叠租约未被正确阻断：${conflict.stderr || conflict.stdout}`)
  }

  writeFileSync(contractPath, `${JSON.stringify({ ...contract, expectedOutcome: '被篡改的契约' }, null, 2)}\n`)
  const changedContract = run(['verify', '--contract', contractPath])
  if (changedContract.status !== 2 || !changedContract.stderr.includes('契约在 start 后发生变化')) {
    throw new Error(`租约未绑定原始契约：${changedContract.stderr || changedContract.stdout}`)
  }
  writeFileSync(contractPath, contractSource)

  writeFileSync(join(repoPath, 'unclaimed.txt'), 'allowed but not leased\n')
  const unclaimed = run(['verify', '--contract', contractPath])
  if (unclaimed.status !== 2 || !unclaimed.stderr.includes('未取得文件租约')) {
    throw new Error(`白名单内未租用文件未被正确阻断：${unclaimed.stderr || unclaimed.stdout}`)
  }
  rmSync(join(repoPath, 'unclaimed.txt'))

  renameSync(join(repoPath, 'allowed.txt'), join(repoPath, 'outside-renamed.txt'))
  const renamedOutOfScope = run(['verify', '--contract', contractPath])
  if (renamedOutOfScope.status !== 2 || !renamedOutOfScope.stderr.includes('fixture:outside-renamed.txt')) {
    throw new Error(`重命名到范围外未被正确阻断：${renamedOutOfScope.stderr || renamedOutOfScope.stdout}`)
  }
  rmSync(join(repoPath, 'outside-renamed.txt'))
  writeFileSync(join(repoPath, 'allowed.txt'), 'before\n')

  writeFileSync(join(repoPath, 'outside.txt'), 'out of scope\n')
  const outOfScope = run(['verify', '--contract', contractPath])
  if (outOfScope.status !== 2 || !outOfScope.stderr.includes('fixture:outside.txt')) {
    throw new Error(`范围外新文件未被正确阻断：${outOfScope.stderr || outOfScope.stdout}`)
  }
  rmSync(join(repoPath, 'outside.txt'))

  writeFileSync(join(repoPath, 'allowed.txt'), 'before\nafter\n')
  expectSuccess(run(['verify', '--contract', contractPath]), 'verify')
  writeFileSync(join(repoPath, 'allowed.txt'), 'before\nafter\nchanged-after-verify\n')
  const staleReport = run(['finish', '--contract', contractPath, '--agent', 'selftest-ai'])
  if (staleReport.status === 0 || !staleReport.stderr.includes('验证后又发生变化')) {
    throw new Error(`验证后的改动未被正确阻断：${staleReport.stderr || staleReport.stdout}`)
  }
  writeFileSync(join(repoPath, 'allowed.txt'), 'before\nafter\n')
  expectSuccess(runFlow(['complete', '--contract', contractPath, '--agent', 'selftest-ai']), 'complete')

  const status = run(['status', '--task', taskId])
  expectSuccess(status, 'status')
  if (!status.stdout.includes('没有匹配的有效 AI 开发租约')) throw new Error('finish 后租约仍存在')

  const report = JSON.parse(readFileSync(join(workspaceRoot, '.tmp', 'ai-tasks', 'reports', `${taskId}.json`), 'utf8'))
  if (!report.success || report.results?.[0]?.exitCode !== 0) throw new Error('成功验证报告内容不正确')

  writeFileSync(join(repoPath, 'allowed.txt'), 'before\n')
  const expiredContract = { ...contract, id: expiredTaskId }
  writeFileSync(contractPath, `${JSON.stringify(expiredContract, null, 2)}\n`)
  expectSuccess(run(['start', '--contract', contractPath, '--agent', 'selftest-ai']), 'expired start')
  const expiredLeasePath = join(runtimeRoot, 'leases', `${expiredTaskId}.json`)
  const expiredLease = JSON.parse(readFileSync(expiredLeasePath, 'utf8'))
  writeFileSync(expiredLeasePath, `${JSON.stringify({ ...expiredLease, expiresAt: Date.now() - 1 }, null, 2)}\n`)
  const expired = run(['verify', '--contract', contractPath])
  if (expired.status !== 2 || !expired.stderr.includes('租约已过期')) {
    throw new Error(`过期租约未被正确阻断：${expired.stderr || expired.stdout}`)
  }
  console.log('✓ ai-task 端到端自测通过：契约锁定、租约冲突、范围验证、报告失效、过期清理与释放均正常')
} finally {
  rmSync(join(runtimeRoot, 'lease-write.lock'), { recursive: true, force: true })
  rmSync(join(runtimeRoot, 'leases', `${taskId}.json`), { force: true })
  rmSync(join(runtimeRoot, 'leases', `${conflictTaskId}.json`), { force: true })
  rmSync(join(runtimeRoot, 'leases', `${expiredTaskId}.json`), { force: true })
  rmSync(join(runtimeRoot, 'reports', `${taskId}.json`), { force: true })
  rmSync(join(runtimeRoot, 'reports', `${expiredTaskId}.json`), { force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
}
