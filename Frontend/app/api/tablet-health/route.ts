import { dashboardVersion } from '@/lib/dashboard-version'
export const dynamic = 'force-dynamic'
export function GET() { return new Response('ready', { headers: { 'X-Dashboard-Version': dashboardVersion(), 'X-Display': 'GlassDeck', 'Cache-Control': 'no-store' } }) }
