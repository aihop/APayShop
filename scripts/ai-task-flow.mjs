#!/usr/bin/env node
// 常用流程的快捷封装；单步命令见 scripts/ai-task.mjs help。
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

const phases = {
  check: () => {
    run('validate', ...args)
    run('verify', ...args, '--dry-run', '--all')
    console.log('✓ 契约结构与验证清单预检完成；尚未取得文件租约')
  },
  prepare: () => {
    run('start', ...args)
    console.log('✓ 开工准备完成；AI 现在只能修改契约 claims 中的路径')
  },
  resume: () => {
    run('resume', ...args)
    console.log('✓ 过期任务现场恢复完成；AI 现在只能修改契约 claims 中的路径')
  },
  extend: () => {
    run('extend', ...args)
  },
  renew: () => {
    run('renew', ...args)
  },
  abort: () => {
    run('abort', ...args)
  },
  complete: () => {
    run('verify', ...args)
    run('finish', ...args)
    console.log('✓ 任务验证通过并已释放租约')
  },
}

if (!phase || phase === 'help' || !phases[phase]) {
  if (phase && phase !== 'help') console.error(`✗ 未知流程阶段：${phase}`)
  console.log(`用法：
  node scripts/ai-task-flow.mjs check    --contract <path>
  node scripts/ai-task-flow.mjs prepare  --contract <path> --agent <name> [--ttl 480]
  node scripts/ai-task-flow.mjs extend   --contract <path> --agent <name> [--confirm EXTEND:<task-id>]
  node scripts/ai-task-flow.mjs renew    --contract <path> --agent <name> [--ttl 480]
  node scripts/ai-task-flow.mjs abort    --contract <path> --agent <name>
  node scripts/ai-task-flow.mjs resume   --contract <path> --agent <name> --confirm RESUME:<task-id> [--ttl 480]
  node scripts/ai-task-flow.mjs complete --contract <path> --agent <name>`)
  process.exit(phase && phase !== 'help' ? 1 : 0)
}

phases[phase]()
