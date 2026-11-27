import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'

const folder = path.join(process.env.LOCALAPPDATA || homedir(), 'GlassDeck', 'widget-preferences')
const filename = (id: string) => path.join(folder, createHash('sha256').update(id).digest('hex') + '.json')

export async function readEnabled(id: string, fallback: boolean) {
  try { return JSON.parse(await readFile(filename(id), 'utf8')) === true }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw e }
}

export async function saveEnabled(id: string, enabled: boolean) {
  await mkdir(folder, { recursive: true })
  const target = filename(id)
  const temporary = target + '.' + randomUUID()
  try {
    await writeFile(temporary, JSON.stringify(enabled), { flag: 'wx' })
    await rename(temporary, target)
  } finally { await rm(temporary, { force: true }) }
}
