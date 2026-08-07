import { spawn } from 'node:child_process'
import { acquireBuildLock } from './build-lock.mjs'

const separatorIndex = process.argv.indexOf('--')
const commandArgs = separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : process.argv.slice(2)
const [command, ...args] = commandArgs
if (!command) {
  console.error('用法: node scripts/run-with-build-lock.mjs -- <command> [...args]')
  process.exit(2)
}

const alreadyHeld = process.env.APAY_BUILD_LOCK_HELD === '1'
const releaseBuildLock = alreadyHeld ? async () => {} : await acquireBuildLock()

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, APAY_BUILD_LOCK_HELD: '1' },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`[build] 子进程被信号 ${signal} 中止`)
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
  process.exitCode = exitCode
}
finally {
  await releaseBuildLock()
}
