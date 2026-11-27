'use client'
import { Children, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
type Tile={id:number;at:number;size:number}
const names=['Scenes','Stream chat','Audio mixer','Spotify']
const initial=names.slice(0,3).map((_,id)=>({id,at:id,size:1}))
const key='centre-three-slots-v1'
function valid(v:unknown):v is Tile[]{
  if(!Array.isArray(v)||v.length>3)return false
  const ids=new Set(),cells=new Set()
  for(const t of v){
    if(!t||!Number.isInteger(t.id)||t.id<0||t.id>=names.length||ids.has(t.id)||!Number.isInteger(t.at)||!Number.isInteger(t.size)||t.at<0||t.size<1||t.at+t.size>3)return false
    ids.add(t.id)
    for(let j=t.at;j<t.at+t.size;j++){if(cells.has(j))return false;cells.add(j)}
  }
  return true
}
function place(list:Tile[],tile:Tile){
  const end = tile.at + tile.size
  const remaining = list.filter(t => t.id !== tile.id).flatMap(t => {
    const oldEnd = t.at + t.size
    if (oldEnd <= tile.at || end <= t.at) return [t]
    if (t.at < tile.at) return [{...t, size:tile.at-t.at}]
    if (oldEnd > end) return [{...t, at:end, size:oldEnd-end}]
    return []
  })
  return [...remaining, tile]
}
function move(list:Tile[],from:Tile,to:Tile){
  if(from.at===to.at)return list
  const edge=to.at>from.at?to.at+to.size-1:to.at
  const slots:Tile[]=[]
  for(let at=0;at<3;){
    const item=list.find(t=>t.at===at)??{id:-1,at,size:1}
    slots.push(item)
    at+=item.size
  }
  const src=slots.findIndex(t=>t.id===from.id)
  const dst=slots.findIndex(t=>edge>=t.at&&edge<t.at+t.size)
  const target=slots[dst]
  slots[dst]=slots[src]
  slots[src]=target
  let at=0
  return slots.map(t=>{const next={...t,at};at+=t.size;return next}).filter(t=>t.id>=0)
}
type Motion={tile:Tile;mode:'move'|'left'|'right';start:number;x:number;y:number;dragged:boolean;pointer:number}
export function ResizeRow({children,onManage}:{children:ReactNode;onManage:()=>void}){
  const [menu,setMenu]=useState<number|null>(null)
  const picking=useRef(false)
  async function selectAction(button:HTMLButtonElement, action:()=>void){
    if(picking.current)return
    picking.current=true
    try{
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        const pulse=button.animate([{backgroundColor:'#586762',transform:'scale(.97)'},{backgroundColor:'#394540',transform:'scale(1)'}],{duration:105})
        await pulse.finished.catch(()=>{})
      }
      if(button.isConnected){setMenu(null);action()}
    }finally{picking.current=false}
  }
  const [front,raise]=useState<number|null>(null)
  const nodes=Children.toArray(children)
  const [tiles,set]=useState(initial),[picker,open]=useState<number|null>(null),[preview,show]=useState<Tile|null>(null)
  const [leaving,exit]=useState<Tile[]>([])
  useEffect(()=>{if(!leaving.length)return;const t=setTimeout(()=>exit([]),220);return ()=>clearTimeout(t)},[leaving])
  const board=useRef<HTMLDivElement>(null),gesture=useRef<Motion|null>(null)
  const client=useRef(Math.random().toString(36).slice(2))
  const outbound=useRef(Promise.resolve())
  const lastSent=useRef(0)
  const pendingWrites=useRef(0)
  function send(data:object){
    pendingWrites.current++
    outbound.current=outbound.current.then(async()=>{
      await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,client:client.current})})
    }).catch(()=>{}).finally(()=>{pendingWrites.current--})
  }
  useEffect(()=>{
    let stopped=false,busy=false,initialized=false
    const refresh=async()=>{
      if(busy||gesture.current||pendingWrites.current)return
      busy=true
      try{
        const r=await fetch('/api/profile',{cache:'no-store'})
        if(!r.ok)return
        const value=await r.json()
        if(stopped||gesture.current||pendingWrites.current)return
        if(valid(value.tiles))set(value.tiles)
        else if(!initialized&&value.tiles===null){
          try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(valid(saved)){set(saved);send({tiles:saved})}}catch{}
        }
        initialized=true
        show(value.owner!==client.current?value.preview:null)
      }catch{}finally{busy=false}
    }
    void refresh()
    const timer=setInterval(refresh,100)
    return ()=>{stopped=true;clearInterval(timer)}
  },[])
  useEffect(()=>{
    if(picker===null)return
    const outside=(e:PointerEvent|globalThis.PointerEvent)=>{
      if(e.target instanceof Element&&!e.target.closest('.slot-chooser,.empty-slot'))open(null)
    }
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')open(null)}
    document.addEventListener('pointerdown',outside)
    document.addEventListener('keydown',escape)
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[picker])
  function commit(next:Tile[]){set(next);send({tiles:next})}
  function cell(x:number){const b=board.current!.getBoundingClientRect();return Math.max(0,Math.min(2,Math.floor(3*(x-b.left)/b.width)))}
  function begin(e:PointerEvent<HTMLElement>,tile:Tile,mode:Motion['mode']){
    if(!e.isPrimary||e.button!==0||gesture.current)return
    raise(tile.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current={tile,mode,start:cell(e.clientX),x:e.clientX,y:e.clientY,dragged:false,pointer:e.pointerId}
  }
  function position(m:Motion,x:number,snap=false){
    const t=m.tile, raw=(x-m.x)*3/board.current!.clientWidth
    const d=snap?Math.round(raw):raw
    const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
    if(m.mode==='move')return {...t,at:clamp(t.at+d,0,3-t.size)}
    if(m.mode==='right')return {...t,size:clamp(t.size+d,1,3-t.at)}
    const at=clamp(t.at+d,0,t.at+t.size-1)
    return {...t,at,size:t.size+t.at-at}
  }
  function coverage(at:number,size:number){
    if(!preview)return 0
    return Math.min(1,Math.max(0,Math.min(at+size,preview.at+preview.size)-Math.max(at,preview.at)))
  }
  function style(t:Tile,removed:boolean){
    const moving=preview?.id===t.id, box=moving?preview:t
    const fade=moving?0:coverage(t.at,t.size)
    return {left:0,translate:(box.at*100/3)+'cqw 0',width:'calc('+box.size*100/3+'% - 2px)',opacity:removed?0:1-fade*.86,
      transform:'scale('+(removed?.95:1-fade*.045)+')',zIndex:moving?3:removed?0:t.id===front?2:1,
      transition:moving?'none':undefined,pointerEvents:removed?'none' as const:undefined}
  }
  function clear(){if(gesture.current?.dragged)send({preview:null});gesture.current=null;show(null)}
  const pos=(t:Tile)=>({gridColumn:(t.at+1)+' / span '+t.size,gridRow:1})
  return <div className="centre-three slot-board" ref={board}
    onPointerMove={e=>{const m=gesture.current;if(m?.pointer===e.pointerId){if(Math.hypot(e.clientX-m.x,e.clientY-m.y)>5)m.dragged=true;if(m.dragged){setMenu(null);const frame=position(m,e.clientX);show(frame);if(performance.now()-lastSent.current>65&&pendingWrites.current===0){lastSent.current=performance.now();send({preview:frame})}}}}}
    onPointerUp={e=>{const m=gesture.current;if(m?.pointer!==e.pointerId)return;if(Math.abs(e.clientX-m.x)>4){const target=position(m,e.clientX,true);const next=m.mode==="move"?move(tiles,m.tile,target):place(tiles,target);exit(tiles.filter(t=>!next.some(n=>n.id===t.id)));commit(next);}else if(m.mode==="move"&&!m.dragged){setMenu(menu===m.tile.id?null:m.tile.id)}clear()}}
    onPointerCancel={clear} onLostPointerCapture={clear}>
    {[0,1,2].filter(i=>!tiles.some(t=>i>=t.at&&i<t.at+t.size)).map(i=><button key={'empty'+i} className="empty-slot" style={{...pos({id:0,at:i,size:1}),opacity:1-coverage(i,1),transform:'scale('+(1-.06*coverage(i,1))+')'}} aria-label={'Add widget in slot '+(i+1)} onClick={()=>open(picker===i?null:i)}>+</button>)}
    {[...tiles,...leaving.filter(t=>!tiles.some(n=>n.id===t.id))].map(t=><div key={t.id} className="centre-slot fitted-slot animated-slot" data-span={preview?.id===t.id?Math.round(preview.size):t.size} style={style(t,!tiles.some(n=>n.id===t.id))}>
      <div className="widget-toolbar">
        <button type="button" className="widget-handle" aria-label={'Actions for '+names[t.id]+'; drag to move'} aria-expanded={menu===t.id}
          onPointerDown={e=>begin(e,t,'move')}
          onClick={e=>{if(e.detail===0)setMenu(menu===t.id?null:t.id)}}><i/></button>
      </div>
      {menu===t.id&&<div className="widget-actions" onKeyDown={e=>{if(e.key==='Escape')setMenu(null)}}>
        {[-1,1].map(d=><button key={d} disabled={t.at+d<0||t.at+t.size+d>3} onClick={e=>selectAction(e.currentTarget,()=>{raise(t.id);commit(move(tiles,t,{...t,at:t.at+d}))})}>{d<0?'Move left':'Move right'}</button>)}
        <button onClick={e=>selectAction(e.currentTarget,()=>commit(tiles.filter(w=>w.id!==t.id)))}>Remove widget</button>
        <button onClick={e=>selectAction(e.currentTarget,onManage)}>Manage widgets</button>
        <button onClick={e=>selectAction(e.currentTarget,()=>{})}>Close</button>
      </div>}
      {nodes[t.id]}
      {(['left','right'] as const).map(side=><button key={side} className={'corner-line '+side} aria-label={'Resize '+names[t.id]+' '+side+' edge'} onPointerDown={e=>begin(e,t,side)} onKeyDown={e=>{
        if(!['ArrowLeft','ArrowRight'].includes(e.key))return
        e.preventDefault();const d=e.key==='ArrowLeft'?-1:1
        const at=side==='left'?Math.max(0,Math.min(t.at+t.size-1,t.at+d)):t.at
        const size=side==='left'?t.size+t.at-at:Math.max(1,Math.min(3-at,t.size+d))
        commit(place(tiles,{...t,at,size}))
      }}/>)}
    </div>)}

    {picker!==null&&<div className="slot-chooser" style={{left:(picker*100/3+100/6)+"%"}} role="dialog" aria-label="Add widget"><strong>Add widget</strong>{names.map((n,id)=><button key={id} onClick={()=>{commit(place(tiles,{id,at:picker,size:1}));open(null)}}>{n}{tiles.some(t=>t.id===id)?' · Move here':''}</button>)}<button onClick={()=>open(null)}>Cancel</button></div>}
  </div>
}
