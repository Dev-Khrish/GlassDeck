import fs from 'node:fs'
import path from 'node:path'
export const dynamic='force-dynamic'
const directory=path.join(process.env.LOCALAPPDATA || process.cwd(),'GlassDeck')
const file=path.join(directory,'profile-layout.json')
type Tile={id:number;at:number;size:number}
let tiles:Tile[]|null=null
try {tiles=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
let preview:Tile|null=null,owner='',seen=0,version=0
function tile(t:Tile,whole:boolean){
  return t && Number.isInteger(t.id)&&t.id>=0&&t.id<4&&Number.isFinite(t.at)&&Number.isFinite(t.size)&&t.at>=0&&t.size>=1&&t.at+t.size<=3.00001&&(!whole||Number.isInteger(t.at)&&Number.isInteger(t.size))
}
export function GET(){
  if(preview&&Date.now()-seen>1300){preview=null;owner='';version++}
  return Response.json({tiles,preview,owner,version},{headers:{'Cache-Control':'no-store'}})
}
export async function POST(req:Request){
  if(req.headers.get('origin')!=='http://'+req.headers.get('host'))return new Response(null,{status:403})
  const data=await req.text()
  if(data.length>1024)return new Response(null,{status:413})
  let body
  try{body=JSON.parse(data)}catch{return new Response(null,{status:400})}
  if(!body||typeof body.client!=='string'||!/^[a-z0-9-]{1,60}$/.test(body.client))return new Response(null,{status:400})
  GET()
  if(owner&&owner!==body.client)return new Response(null,{status:409})
  if(body.tiles!==undefined){
    const next=body.tiles
    if(!Array.isArray(next)||next.length>3||!next.every(t=>tile(t,true))||new Set(next.map(t=>t.id)).size!==next.length||
      next.some((t,i)=>next.some((u,j)=>j<i&&t.at<u.at+u.size&&u.at<t.at+t.size)))return new Response(null,{status:400})
    fs.mkdirSync(directory,{recursive:true})
    fs.writeFileSync(file+'.tmp',JSON.stringify(next))
    fs.renameSync(file+'.tmp',file)
    tiles=next;preview=null;owner='';version++
  }else if(body.preview===null||tile(body.preview,false)){
    preview=body.preview;owner=preview?body.client:'';seen=Date.now();version++
  }else return new Response(null,{status:400})
  return GET()
}
