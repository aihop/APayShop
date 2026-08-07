import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireBuildLock } from './build-lock.mjs'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const nuxtBin = path.join(projectRoot, 'node_modules/nuxt/bin/nuxt.mjs')
const themeBuildScript = path.join(projectRoot, 'scripts/generate-theme-build.mjs')
const alreadyHeld = process.env.APAY_BUILD_LOCK_HELD === '1'
const releaseBuildLock = alreadyHeld ? async () => {} : await acquireBuildLock()

try {
  const childEnvironment = { ...process.env, APAY_BUILD_LOCK_HELD: '1' }
  const prepareExitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [themeBuildScript], {
      cwd: projectRoot,
      env: childEnvironment,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
  if (prepareExitCode !== 0) throw new Error(`主题构建清单生成失败（退出码 ${prepareExitCode}）`)

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nuxtBin, 'build', ...process.argv.slice(2)], {
      cwd: projectRoot,
      env: childEnvironment,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`[build] Nuxt 构建被信号 ${signal} 中止`)
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
