import { readEnabled } from './widget-preferences'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { WidgetMetadata } from './widget-metadata'

export async function readWidgetCatalog(): Promise<WidgetMetadata[]> {
  const root = path.join(process.cwd(), 'widgets')
  const widgets: WidgetMetadata[] = []
  const names = new Set<string>()
  const ids = new Set<string>()
  for (const provider of await readdir(root, { withFileTypes: true })) {
    if (!provider.isDirectory()) continue
    const folder = path.join(root, provider.name)
    for (const file of await readdir(folder, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue
      try {
        const widget = JSON.parse(await readFile(path.join(folder, file.name), 'utf8'))
        if (!widget || !['id','name','description','icon','color'].every(key => typeof widget[key] === 'string' && widget[key].trim()) ||
            !Number.isFinite(widget.order) || typeof widget.enabled !== 'boolean' || ids.has(widget.id) || names.has(widget.name)) throw Error('Invalid or duplicate metadata')
        ids.add(widget.id)
        names.add(widget.name)
        const {id, name, description, icon, color, enabled, order} = widget
        widgets.push({id, name, description, icon, color, enabled, order})
      } catch { console.warn('Skipped widget metadata', provider.name, file.name) }
    }
  }
  await Promise.all(widgets.map(async widget => { widget.enabled = await readEnabled(widget.id, widget.enabled) }))
  return widgets.sort((a,b) => a.order - b.order || a.id.localeCompare(b.id))
}
