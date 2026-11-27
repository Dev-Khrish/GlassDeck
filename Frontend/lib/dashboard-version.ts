import { readFileSync } from 'node:fs'
import path from 'node:path'
let version: string | undefined
export function dashboardVersion() {
  return version ??= process.env.NODE_ENV === 'development' ? 'development' :
    readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
}
