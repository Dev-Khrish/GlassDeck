import { readWidgetCatalog } from '@/lib/widget-catalog'
export const dynamic = 'force-dynamic'
import { DokidekDisplay } from '@/components/dokidek-display'

export default async function Page() {
  return <DokidekDisplay catalog={await readWidgetCatalog()} />
}
