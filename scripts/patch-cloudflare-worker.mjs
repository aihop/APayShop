#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'dist/_worker.js/chunks/nitro/nitro.mjs')

if (!fs.existsSync(target)) {
  console.warn(`[patch-cloudflare-worker] skip, file not found: ${target}`)
  process.exit(0)
}

const source = fs.readFileSync(target, 'utf8')
const pattern = /\b([A-Za-z_$][\w$]*)\.hasOwnProperty\(([^()]+)\)/g

let replacements = 0
const patched = source.replace(pattern, (_match, objectName, argumentExpr) => {
  replacements += 1
  return `Object.prototype.hasOwnProperty.call(${objectName},${argumentExpr})`
})

if (replacements === 0) {
  console.log('[patch-cloudflare-worker] no unsafe hasOwnProperty calls found')
  process.exit(0)
}

fs.writeFileSync(target, patched)
console.log(`[patch-cloudflare-worker] patched ${replacements} unsafe hasOwnProperty call(s) in ${target}`)
