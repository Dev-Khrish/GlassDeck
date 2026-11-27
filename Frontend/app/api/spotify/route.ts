import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
const run=promisify(execFile)
const bridge=path.resolve(process.cwd(),'../TabletTools/spotify.ps1')
let cached='',stamp=0
let pending:Promise<string>|undefined
async function read(action:string){
  const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',bridge,action],{windowsHide:true,timeout:9000,maxBuffer:1024*1024})
  const json=JSON.stringify(JSON.parse(stdout.trim()))
  cached=json;stamp=Date.now()
  return json
}
const reply=(body:string)=>new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
export const dynamic='force-dynamic'
const lyricCache = new Map<string, { expires: number; result: Promise<string> }>()
async function lookupLyrics(media: string) {
  const track = JSON.parse(media)
  if (!track.title || !track.artist) return reply('{}')
  const query = new URLSearchParams({ track_name: track.title, artist_name: track.artist, album_name: track.album || '' })
  if (track.duration > 0) query.set('duration', String(Math.round(track.duration)))
  const key = query.toString()
  const hit = lyricCache.get(key)
  if (hit && hit.expires > Date.now()) return reply(await hit.result)
  const result = (async () => {
    const response = await fetch('https://lrclib.net/api/get?' + key, {
      cache: 'no-store', signal: AbortSignal.timeout(7500), headers: { 'User-Agent': 'GlassDeck/0.1.2' },
    })
    if (response.status === 404) return '{}'
    if (!response.ok) throw Error('Lyrics unavailable')
    const data = await response.json()
    return JSON.stringify({ synced: data.syncedLyrics, plain: data.plainLyrics, instrumental: data.instrumental })
  })().catch(error => { lyricCache.delete(key); throw error })
  if (lyricCache.size >= 64) lyricCache.delete(lyricCache.keys().next().value!)
  lyricCache.set(key, { expires: Date.now() + 3600000, result })
  return reply(await result)
}

export async function GET(req: Request){
  try{
    if(Date.now()-stamp>=3000)pending??=read('state').finally(()=>{pending=undefined})
    const media=pending?await pending:cached
    return new URL(req.url).searchParams.get('view')==='lyrics'?await lookupLyrics(media):reply(media)
  }catch{return Response.json({error:'Windows media session unavailable'},{status:503})}
}
export async function POST(req:Request){
  if(req.headers.get('origin')!=='http://'+req.headers.get('host'))return new Response(null,{status:403})
  const action=new URL(req.url).searchParams.get('action')||''
  if(!['play','pause','next','previous'].includes(action))return new Response(null,{status:400})
  try{await pending;return reply(await read(action))}catch{return Response.json({error:'Playback control unavailable'},{status:503})}
}
