#!/usr/bin/env node
// ai-task 端到端自测：在临时 Git 仓库里走完契约、租约、范围、验证、扩围、续租、放弃、过期与恢复。
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
const otherContractPath = join(fixtureRoot, 'other.json')
const extendContractPath = join(fixtureRoot, 'extend.json')
const taskId = `ai-task-selftest-${process.pid}`
const otherTaskId = `${taskId}-other`
const extendTaskId = `${taskId}-extend`
const renewTaskId = `${taskId}-renew`
const expiredTaskId = `${taskId}-expired`
const resumeTaskId = `${taskId}-resume`
const allTaskIds = [taskId, otherTaskId, extendTaskId, renewTaskId, expiredTaskId, resumeTaskId]
const runtimeRoot = join(workspaceRoot, '.tmp', 'ai-tasks')
const agent = 'selftest-ai'

const run = (args) => spawnSync(process.execPath, [cliPath, ...args], { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' })
const runFlow = (args) => spawnSync(process.execPath, [flowPath, ...args], { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' })
const output = result => `${result.stderr || ''}${result.stdout || ''}`
const expectSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label} 失败：${output(result)}`)
}
const expectFailure = (result, label, needle, code) => {
  if (result.status === 0) throw new Error(`${label}：本应失败却成功了`)
  if (code !== undefined && result.status !== code) throw new Error(`${label}：退出码应为 ${code}，实际 ${result.status}\n${output(result)}`)
  if (needle && !output(result).includes(needle)) throw new Error(`${label}：输出缺少「${needle}」\n${output(result)}`)
}
const writeContract = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const readLease = id => JSON.parse(readFileSync(join(runtimeRoot, 'leases', `${id}.json`), 'utf8'))
const readReport = id => JSON.parse(readFileSync(join(runtimeRoot, 'reports', `${id}.json`), 'utf8'))
const inRepo = name => join(repoPath, name)
const gitRepo = args => execFileSync('git', args, { cwd: repoPath, stdio: 'ignore' })

try {
  mkdirSync(repoPath, { recursive: true })
  gitRepo(['init'])
  gitRepo(['config', 'user.email', 'ai-task@example.test'])
  gitRepo(['config', 'user.name', 'AI Task Selftest'])
  writeFileSync(inRepo('allowed.txt'), 'before\n')
  gitRepo(['add', 'allowed.txt'])
  gitRepo(['commit', '-m', 'fixture'])

  const verifyAllowedHasAfter = `${process.execPath} -e "const fs=require('fs');if(!fs.readFileSync('allowed.txt','utf8').includes('after'))process.exit(1)"`
  // 精简契约：只有 id/title/claims/verification
  const contract = {
    schemaVersion: 1,
    id: taskId,
    title: 'AI 任务流程端到端自测',
    repositories: [{ name: 'fixture', path: repoPath, claims: ['allowed.txt'] }],
    verification: [{ name: '内容合同', repository: 'fixture', triggers: ['allowed.txt'], command: verifyAllowedHasAfter }],
  }
  const contractSource = `${JSON.stringify(contract, null, 2)}\n`
  writeFileSync(contractPath, contractSource)

  // ---- 校验 ----
  expectSuccess(run(['validate', '--contract', contractPath]), 'validate 精简契约')
  writeContract(otherContractPath, { ...contract, id: `${taskId}-invalid`, repositories: [{ name: 'fixture', path: repoPath, allowedPaths: ['allowed.txt'], claims: ['allowed.txt/**'] }] })
  expectFailure(run(['validate', '--contract', otherContractPath]), 'allowedPaths 外的目录 claim', 'claim 不在 allowedPaths 内')
  writeContract(otherContractPath, { ...contract, id: `${taskId}-noverify`, verification: [] })
  expectFailure(run(['validate', '--contract', otherContractPath]), '缺少验证项', 'verification 不能为空')

  // ---- 开工与基本门禁 ----
  expectSuccess(runFlow(['prepare', '--contract', contractPath, '--agent', agent]), 'prepare')
  const lease = readLease(taskId)
  const ttlMinutes = Math.round((lease.expiresAt - lease.createdAt) / 60000)
  if (ttlMinutes !== 480) throw new Error(`默认 TTL 应为 480 分钟，实际 ${ttlMinutes}`)
  expectFailure(run(['verify', '--contract', contractPath]), '无实际改动', '没有产生 claims 范围内的实际改动', 2)
  expectFailure(run(['start', '--contract', contractPath, '--agent', agent]), '重复 start', '不能重置开工基线', 2)
  expectFailure(run(['start', '--contract', contractPath, '--agent', 'other-ai']), '他人抢占', `已被 ${agent} 占用`, 2)
  expectFailure(run(['finish', '--contract', contractPath, '--agent', agent]), '无报告 finish', '尚无成功验证报告')
  writeContract(otherContractPath, {
    ...contract,
    id: `${taskId}-conflict`,
    repositories: [{ name: 'fixture-alias', path: repoPath, claims: ['allowed.txt'] }],
    verification: [{ ...contract.verification[0], repository: 'fixture-alias' }],
  })
  expectFailure(run(['start', '--contract', otherContractPath, '--agent', 'other-ai']), '重叠租约', '文件租约冲突', 2)

  writeFileSync(contractPath, `${JSON.stringify({ ...contract, title: '被篡改的契约' }, null, 2)}\n`)
  expectFailure(run(['verify', '--contract', contractPath]), '契约篡改', '契约在 start 后发生变化', 2)
  writeFileSync(contractPath, contractSource)

  // ---- 范围：越界、忽略项、其他租约、他人提交 ----
  writeFileSync(inRepo('outside.txt'), 'out of scope\n')
  expectFailure(run(['verify', '--contract', contractPath]), '范围外新文件', 'fixture:outside.txt', 2)
  rmSync(inRepo('outside.txt'))

  writeFileSync(inRepo('allowed.txt'), 'before\nafter\n')
  writeFileSync(inRepo('.DS_Store'), 'finder\n')
  expectSuccess(run(['verify', '--contract', contractPath]), '.DS_Store 不算越界')
  rmSync(inRepo('.DS_Store'))

  writeContract(otherContractPath, {
    ...contract,
    id: otherTaskId,
    repositories: [{ name: 'fixture', path: repoPath, claims: ['other.txt'] }],
    verification: [{ name: '占位', repository: 'fixture', always: true, command: 'true' }],
  })
  expectSuccess(run(['start', '--contract', otherContractPath, '--agent', 'other-ai']), '他人开工')
  writeFileSync(inRepo('other.txt'), 'other session\n')
  expectSuccess(run(['verify', '--contract', contractPath]), '其他活动租约的 claims 不算越界')
  expectFailure(run(['abort', '--contract', otherContractPath, '--agent', agent]), '非持有人 abort', '无权放弃')
  expectSuccess(run(['abort', '--contract', otherContractPath, '--agent', 'other-ai']), '他人 abort')
  expectFailure(run(['verify', '--contract', contractPath]), '租约释放后的脏文件算越界', 'fixture:other.txt', 2)
  rmSync(inRepo('other.txt'))

  writeFileSync(inRepo('committed-by-someone.txt'), 'landed\n')
  gitRepo(['add', 'committed-by-someone.txt'])
  gitRepo(['commit', '-m', 'someone else landed a change'])
  expectSuccess(run(['verify', '--contract', contractPath]), '他人已提交的改动不阻断')

  renameSync(inRepo('allowed.txt'), inRepo('outside-renamed.txt'))
  expectFailure(run(['verify', '--contract', contractPath]), '重命名到范围外', 'fixture:outside-renamed.txt', 2)
  rmSync(inRepo('outside-renamed.txt'))
  writeFileSync(inRepo('allowed.txt'), 'before\nafter\n')

  // ---- 验证后变化只看 claims ----
  expectSuccess(run(['verify', '--contract', contractPath]), 'verify')
  writeFileSync(inRepo('allowed.txt'), 'before\nafter\nchanged-after-verify\n')
  expectFailure(run(['finish', '--contract', contractPath, '--agent', agent]), 'claims 内验证后改动', 'claims 内文件在验证后又发生变化')
  writeFileSync(inRepo('allowed.txt'), 'before\nafter\n')
  writeFileSync(inRepo('unrelated-after-verify.txt'), 'someone else\n')
  expectSuccess(run(['finish', '--contract', contractPath, '--agent', agent]), 'claims 外验证后改动不阻断 finish')
  rmSync(inRepo('unrelated-after-verify.txt'))
  const status = run(['status', '--task', taskId])
  expectSuccess(status, 'status')
  if (!status.stdout.includes('没有匹配的有效 AI 开发租约')) throw new Error('finish 后租约仍存在')
  const report = readReport(taskId)
  if (!report.success || report.results?.[0]?.exitCode !== 0 || !report.finishedAt || report.finishedBy !== agent) {
    throw new Error('成功验证报告内容不正确')
  }
  if (!report.scopeStates?.fixture?.paths?.includes('allowed.txt')) throw new Error('报告缺少 claims 范围摘要')
  gitRepo(['checkout', '--', 'allowed.txt'])

  // ---- 扩围：预算内免确认，预算外需确认 ----
  const extendContract = {
    ...contract,
    id: extendTaskId,
    repositories: [{ name: 'fixture', path: repoPath, allowedPaths: ['allowed.txt', 'budget.txt'], claims: ['allowed.txt'] }],
    verification: [{ name: '内容合同', repository: 'fixture', always: true, command: verifyAllowedHasAfter }],
  }
  writeContract(extendContractPath, extendContract)
  expectSuccess(run(['start', '--contract', extendContractPath, '--agent', agent]), 'extend 用例开工')
  writeFileSync(inRepo('allowed.txt'), 'before\nafter\n')
  writeFileSync(inRepo('budget.txt'), 'needed later\n')
  expectFailure(run(['verify', '--contract', extendContractPath]), '未扩围前越界', 'fixture:budget.txt', 2)
  expectFailure(run(['extend', '--contract', extendContractPath, '--agent', agent]), '契约未变时 extend', '无需扩围')
  writeContract(extendContractPath, { ...extendContract, repositories: [{ ...extendContract.repositories[0], claims: ['allowed.txt', 'budget.txt'] }] })
  expectFailure(run(['verify', '--contract', extendContractPath]), '契约已改但未 extend', '请执行 extend', 2)
  expectFailure(run(['extend', '--contract', extendContractPath, '--agent', 'other-ai']), '非持有人 extend', '无权扩围')
  const withinBudget = run(['extend', '--contract', extendContractPath, '--agent', agent])
  expectSuccess(withinBudget, '预算内扩围')
  if (!withinBudget.stdout.includes('allowedPaths 预算内')) throw new Error(`预算内扩围应免确认：${withinBudget.stdout}`)
  expectSuccess(run(['verify', '--contract', extendContractPath]), '扩围后 verify')
  if (!readReport(extendTaskId).taskChangedByRepo.fixture.includes('budget.txt')) throw new Error('扩围前的现场改动未被计入本任务')

  writeContract(extendContractPath, { ...extendContract, repositories: [{ name: 'fixture', path: repoPath, allowedPaths: ['allowed.txt', 'budget.txt', 'beyond.txt'], claims: ['allowed.txt', 'budget.txt', 'beyond.txt'] }] })
  expectFailure(run(['extend', '--contract', extendContractPath, '--agent', agent]), '预算外扩围未确认', `--confirm EXTEND:${extendTaskId}`, 2)
  expectFailure(run(['extend', '--contract', extendContractPath, '--agent', agent, '--confirm', `EXTEND:${taskId}`]), '错误确认串', `EXTEND:${extendTaskId}`, 2)
  const beyondBudget = run(['extend', '--contract', extendContractPath, '--agent', agent, '--confirm', `EXTEND:${extendTaskId}`])
  expectSuccess(beyondBudget, '预算外扩围')
  if (!beyondBudget.stdout.includes('用户确认')) throw new Error(`预算外扩围应记录用户确认：${beyondBudget.stdout}`)
  expectFailure(run(['finish', '--contract', extendContractPath, '--agent', agent]), '扩围后旧报告失效', '尚无成功验证报告')
  writeContract(extendContractPath, { ...extendContract, repositories: [{ name: 'fixture', path: repoPath, allowedPaths: ['allowed.txt', 'budget.txt', 'beyond.txt'], claims: ['allowed.txt'] }] })
  expectFailure(run(['extend', '--contract', extendContractPath, '--agent', agent]), '缩减 claims', '不能在活动租约上缩减 claims', 2)
  writeContract(extendContractPath, { ...extendContract, repositories: [{ name: 'fixture', path: repoPath, allowedPaths: ['allowed.txt', 'budget.txt', 'beyond.txt'], claims: ['allowed.txt', 'budget.txt', 'beyond.txt'] }] })
  writeFileSync(inRepo('beyond.txt'), 'confirmed\n')
  expectSuccess(runFlow(['complete', '--contract', extendContractPath, '--agent', agent]), '扩围后 complete')
  rmSync(inRepo('budget.txt'))
  rmSync(inRepo('beyond.txt'))
  gitRepo(['checkout', '--', 'allowed.txt'])

  // ---- 续租 ----
  writeContract(contractPath, { ...contract, id: renewTaskId })
  expectSuccess(run(['start', '--contract', contractPath, '--agent', agent, '--ttl', '30']), 'renew 用例开工')
  expectFailure(run(['renew', '--contract', contractPath, '--agent', 'other-ai']), '非持有人 renew', '无权续租')
  expectSuccess(runFlow(['renew', '--contract', contractPath, '--agent', agent, '--ttl', '600']), 'renew')
  const renewed = readLease(renewTaskId)
  if (renewed.expiresAt - Date.now() < 590 * 60000 || renewed.renewals?.length !== 1) throw new Error('renew 未延长到期时间')
  expectSuccess(runFlow(['abort', '--contract', contractPath, '--agent', agent]), 'abort')
  expectFailure(run(['renew', '--contract', contractPath, '--agent', agent]), 'abort 后 renew', '没有有效租约')

  // ---- 过期与恢复 ----
  writeContract(contractPath, { ...contract, id: expiredTaskId })
  expectSuccess(run(['start', '--contract', contractPath, '--agent', agent]), 'expired start')
  const expiredLeasePath = join(runtimeRoot, 'leases', `${expiredTaskId}.json`)
  writeFileSync(expiredLeasePath, `${JSON.stringify({ ...readLease(expiredTaskId), expiresAt: Date.now() - 1 }, null, 2)}\n`)
  expectFailure(run(['verify', '--contract', contractPath]), '过期租约', '租约已过期', 2)

  writeContract(contractPath, { ...contract, id: resumeTaskId })
  writeFileSync(inRepo('allowed.txt'), 'before\nafter\nresume\n')
  expectFailure(run(['start', '--contract', contractPath, '--agent', agent]), 'claims 已脏时 start', '请 resume', 2)
  expectFailure(run(['resume', '--contract', contractPath, '--agent', agent, '--confirm', `RESUME:${taskId}`]), '错误 resume 确认串', `RESUME:${resumeTaskId}`, 2)
  expectSuccess(runFlow(['resume', '--contract', contractPath, '--agent', agent, '--confirm', `RESUME:${resumeTaskId}`]), 'resume')
  expectSuccess(runFlow(['complete', '--contract', contractPath, '--agent', agent]), 'resume complete')

  console.log('✓ ai-task 端到端自测通过：精简契约、租约冲突、只看 claims 的范围与释放检查、扩围/续租/放弃、过期与 resume 均正常')
} finally {
  rmSync(join(runtimeRoot, 'lease-write.lock'), { recursive: true, force: true })
  for (const id of [...allTaskIds, `${taskId}-conflict`]) {
    rmSync(join(runtimeRoot, 'leases', `${id}.json`), { force: true })
    rmSync(join(runtimeRoot, 'reports', `${id}.json`), { force: true })
  }
  rmSync(fixtureRoot, { recursive: true, force: true })
}
