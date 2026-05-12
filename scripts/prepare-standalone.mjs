import { constants } from 'node:fs'
import { access, cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const rootDir = process.cwd()
const standaloneDir = path.join(rootDir, '.next', 'standalone')
const sourceStaticDir = path.join(rootDir, '.next', 'static')
const sourcePublicDir = path.join(rootDir, 'public')
const targetStaticDir = path.join(standaloneDir, '.next', 'static')
const targetPublicDir = path.join(standaloneDir, 'public')

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

if (!(await pathExists(standaloneDir))) {
  console.log('[prepare-standalone] skipped: standalone output not generated')
  process.exit(0)
}

await mkdir(path.dirname(targetStaticDir), { recursive: true })

await rm(targetStaticDir, { recursive: true, force: true })
if (await pathExists(sourceStaticDir)) {
  await cp(sourceStaticDir, targetStaticDir, { recursive: true })
}

await rm(targetPublicDir, { recursive: true, force: true })
if (await pathExists(sourcePublicDir)) {
  await cp(sourcePublicDir, targetPublicDir, { recursive: true })
}

console.log('[prepare-standalone] copied static and public assets into standalone output')
