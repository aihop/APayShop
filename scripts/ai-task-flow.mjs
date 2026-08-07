#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'ai-task.mjs')
const phase = process.argv[2]
const args = process.argv.slice(3)

const run = (...commandArgs) => {
  const result = spawnSync(process.execPath, [cliPath, ...commandArgs], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

if (!phase || phase === 'help') {
  console.log(`用法：
  node scripts/ai-task-flow.mjs check --contract <path>
  node scripts/ai-task-flow.mjs prepare --contract <path> --agent <name> [--ttl 120]
  node scripts/ai-task-flow.mjs complete --contract <path> --agent <name>`)
  process.exit(0)
}

if (phase === 'check') {
  run('validate', ...args)
  run('verify', ...args, '--dry-run', '--all')
  console.log('✓ 契约结构与验证清单预检完成；尚未取得文件租约')
  process.exit(0)
}

if (phase === 'prepare') {
  run('validate', ...args)
  run('start', ...args, '--dry-run')
  run('start', ...args)
  console.log('✓ 开工准备完成；AI 现在只能修改契约 claims 中的路径')
  process.exit(0)
}

if (phase === 'complete') {
  run('verify', ...args)
  run('finish', ...args)
  console.log('✓ 任务验证通过并已释放租约')
  process.exit(0)
}

console.error(`✗ 未知流程阶段：${phase}`)
process.exit(1)
