import { readWidgetCatalog } from '@/lib/widget-catalog'
import { saveEnabled } from '@/lib/widget-preferences'

export async function PUT(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!host || !/^(localhost|127[.]0[.]0[.]1)(:[0-9]+)?$/.test(host) || origin !== 'http://' + host)
    return new Response(null, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.enabled !== 'boolean' || typeof body.id !== 'string')
    return new Response(null, { status: 400 })
  if (!(await readWidgetCatalog()).some(widget => widget.id === body.id))
    return new Response(null, { status: 404 })
  await saveEnabled(body.id, body.enabled)
  return new Response(null, { status: 204 })
}
