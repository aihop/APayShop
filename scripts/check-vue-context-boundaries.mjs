#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const projectRoot = process.cwd()
const forbiddenCalls = new Set(['useI18n'])
const sourceExtensions = new Set(['.js', '.mjs', '.ts'])

const listSourceFiles = (directory) => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return listSourceFiles(absolutePath)
      if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name)) || entry.name.endsWith('.d.ts')) return []
      return [absolutePath]
    })
    .sort()
}

const relativePath = filePath => path.relative(projectRoot, filePath).split(path.sep).join('/')
const parsedFiles = new Map()
const parseSource = (filePath) => {
  const cached = parsedFiles.get(filePath)
  if (cached) return cached
  const scriptKind = path.extname(filePath) === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
  parsedFiles.set(filePath, sourceFile)
  return sourceFile
}

const isExported = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const composables = new Map()

for (const filePath of listSourceFiles(path.join(projectRoot, 'app/composables'))) {
  const sourceFile = parseSource(filePath)
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      composables.set(statement.name.text, { filePath, node: statement, sourceFile })
      continue
    }
    if (!ts.isVariableStatement(statement) || !isExported(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
      if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue
      composables.set(declaration.name.text, { filePath, node: declaration.initializer, sourceFile })
    }
  }
}

const collectCalls = (node, sourceFile, filePath) => {
  const calls = []
  const visit = (child) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
      const position = sourceFile.getLineAndCharacterOfPosition(child.expression.getStart(sourceFile))
      calls.push({
        name: child.expression.text,
        file: relativePath(filePath),
        line: position.line + 1,
      })
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return calls
}

const violations = new Set()

const traceCalls = (node, sourceFile, filePath, chain, activeComposables) => {
  for (const call of collectCalls(node, sourceFile, filePath)) {
    const nextChain = [...chain, call]
    if (forbiddenCalls.has(call.name)) {
      violations.add(nextChain.map(frame => `${frame.file}:${frame.line} ${frame.name}()`).join('\n  -> '))
      continue
    }
    const composable = composables.get(call.name)
    if (!composable || activeComposables.has(call.name)) continue
    traceCalls(
      composable.node,
      composable.sourceFile,
      composable.filePath,
      nextChain,
      new Set([...activeComposables, call.name]),
    )
  }
}

const entryFiles = [
  ...listSourceFiles(path.join(projectRoot, 'app/middleware')),
  ...listSourceFiles(path.join(projectRoot, 'app/plugins')),
]

for (const filePath of entryFiles) {
  const sourceFile = parseSource(filePath)
  traceCalls(sourceFile, sourceFile, filePath, [], new Set())
}

if (violations.size) {
  console.error('✗ Vue 上下文边界违规：中间件或插件不得直接或间接调用 useI18n()')
  for (const violation of violations) console.error(`\n  ${violation}`)
  process.exitCode = 1
}
else {
  console.log(`✓ Vue 上下文边界守卫通过（${entryFiles.length} 个入口，${composables.size} 个 composable）`)
}
