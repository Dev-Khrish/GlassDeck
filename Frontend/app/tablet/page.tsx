import { WatchVersion } from './watch-version'
import { dashboardVersion } from '@/lib/dashboard-version'
import { readWidgetCatalog } from '@/lib/widget-catalog'
import { DokidekDisplay } from '@/components/dokidek-display'
export const dynamic = 'force-dynamic'
export default async function Tablet() {
  const widgets = await readWidgetCatalog()
  return <><WatchVersion version={dashboardVersion()} /><DokidekDisplay catalog={widgets} tablet /></>
}
