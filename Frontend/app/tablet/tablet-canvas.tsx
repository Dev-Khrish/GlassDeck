'use client'
import { useEffect, useRef, useState } from 'react'
import './touch.css'

type Panel = {kind:string; title:string; accent:string}
type Layout = {four:boolean; panels:Panel[]; widths:number[]; halves:number[]; top:number}
const colors=['#a8efd5','#b9c9ff','#ffd39b','#eab9ff']
const cap=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
function initial(choices:string[]):Layout {
  const kinds=[...new Set([...['Stream timer','Now playing','Audio mixer','Countdown'].filter(k=>choices.includes(k)),...choices,'Clock'])]
  return {four:false, panels:colors.map((accent,i)=>({kind:kinds[i%kinds.length],title:'',accent})),widths:[1/3,1/3,1/3],halves:[.5,.5],top:.5}
}
function Content({kind}:{kind:string}) {
  const [now,time]=useState(0), [playing,play]=useState(false), [start,setStart]=useState(0), [elapsed,setElapsed]=useState(0)
  const [levels,setLevels]=useState([72,50,85]),[track,setTrack]=useState(0)
  useEffect(()=>{time(Date.now()); const t=setInterval(()=>time(Date.now()),500);return ()=>clearInterval(t)},[])
  const seconds=Math.floor((elapsed+(start?Math.max(0,now-start):0))/1000)
  const value=kind==='Countdown'?Math.max(0,60-seconds):seconds
  if(kind==='Clock')return <strong className="digits">{now?new Date(now).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}</strong>
  if(kind==='Stream timer'||kind==='Countdown')return <><strong className="digits">{Math.floor(value/60)}:{String(value%60).padStart(2,'0')}</strong><div><button onClick={()=>{const t=Date.now();time(t);if(start){setElapsed(elapsed+t-start);setStart(0)}else{if(kind==='Countdown'&&!value)setElapsed(0);setStart(t)}}}>{start?'Pause':'Start'}</button> <button onClick={()=>{setStart(0);setElapsed(0)}}>Reset</button></div></>
  if(kind==='Audio mixer')return <div className="touch-levels">{['System','Music','Voice'].map((v,i)=><label key={v}>{v} · {levels[i]}%<input aria-label={v} type="range" value={levels[i]} onChange={e=>setLevels(levels.map((n,j)=>j===i?+e.target.value:n))}/></label>)}</div>
  if(kind==='Now playing')return <><small>Playback preview</small><strong>{['Midnight Current','Blue Hours','Northbound'][track]}</strong><div><button onClick={()=>play(!playing)}>{playing?'Pause':'Play'}</button> <button onClick={()=>setTrack((track+1)%3)}>Next</button></div></>
  const sample:Record<string,string[]>={'Stream chat':['kairo · Good evening','drift · Clean setup'],Notifications:['No new notifications'],'Friends map':['4 friends online'],'Game status':['The Witcher 3']}
  return <>{(sample[kind]||['Widget preview']).map(line=><p key={line}>{line}</p>)}</>
}

export function TabletCanvas({choices}:{choices:string[]}) {
  const options=[...new Set([...choices,'Clock'])]
  const [layout,set]=useState(()=>initial(choices)),[ready,setReady]=useState(false),[edit,select]=useState<number|null>(null)
  const board=useRef<HTMLElement>(null)
  const drag=useRef<{i:number;x:number;y:number;base:Layout}|null>(null)
  useEffect(()=>{try{const s=JSON.parse(localStorage.getItem('touch-layout-v1')||'null');if(s?.panels?.length===4&&s.widths?.length===3&&s.halves?.length===2&&Number.isFinite(s.top))set({...s,panels:s.panels.map((p:Panel)=>options.includes(p.kind)?p:{...p,kind:'Clock'})})}catch{}setReady(true)},[])
  useEffect(()=>{if(!ready)return;const t=setTimeout(()=>{try{localStorage.setItem('touch-layout-v1',JSON.stringify(layout))}catch{}},120);return ()=>clearTimeout(t)},[layout,ready])
  function patch(p:Partial<Panel>){set(l=>({...l,panels:l.panels.map((w,i)=>i===edit?{...w,...p}:w)}))}
  const rows=layout.four?[[0,1],[2,3]]:[[0,1,2]]
  return <main className="touch-board" ref={board}>{rows.map((row,r)=><div key={r} className="touch-row" style={{flex:layout.four?(r?1-layout.top:layout.top):1}}>{row.map(i=>{
    const p=layout.panels[i],leftGrip=layout.four?i%2===1:i===2
    return <section key={i} className="touch-pane" style={{flex:layout.four?(i%2?1-layout.halves[r]:layout.halves[r]):layout.widths[i],borderColor:p.accent+'66'}}>
      <header><b style={{color:p.accent}}>{p.title||p.kind}</b><button aria-label={'Customize '+(p.title||p.kind)} onClick={()=>select(i)}>⚙</button></header>
      <div className="touch-content"><Content key={p.kind} kind={p.kind}/></div>
      <button aria-label={'Resize '+(p.title||p.kind)} className={'touch-grip '+(leftGrip?'left ':'')+(r?'upper':'')} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={i,x:e.clientX,y:e.clientY,base:layout}}} onPointerMove={e=>{
        const d=drag.current,box=board.current?.getBoundingClientRect();if(!d||d.i!==i||!box)return
        const dx=(e.clientX-d.x)/box.width,dy=(e.clientY-d.y)/box.height
        if(d.base.four){const halves=[...d.base.halves];halves[r]=cap(halves[r]+dx,.22,.78);set({...d.base,halves,top:cap(d.base.top+dy,.28,.72)})}
        else{const peers=d.base.widths.filter((_,j)=>j!==i);const change=cap(dx*(leftGrip?-1:1),.18-d.base.widths[i],2*(Math.min(...peers)-.18));set({...d.base,widths:d.base.widths.map((w,j)=>w+(i===j?change:-change/2))})}
      }} onLostPointerCapture={()=>{drag.current=null}}>⤢</button></section>})}</div>)}
      {edit!==null&&<div className="touch-shade"><section className="touch-settings" role="dialog" aria-label="Panel settings"><h2>Panel settings</h2><label>Widget<select value={layout.panels[edit].kind} onChange={e=>patch({kind:e.target.value})}>{options.map(k=><option key={k}>{k}</option>)}</select></label><label>Title<input maxLength={30} value={layout.panels[edit].title} placeholder={layout.panels[edit].kind} onChange={e=>patch({title:e.target.value})}/></label><label>Accent<input type="color" value={layout.panels[edit].accent} onChange={e=>patch({accent:e.target.value})}/></label><label>Screen layout<select value={layout.four?'4':'3'} onChange={e=>set({...layout,four:e.target.value==='4'})}><option value="3">Three across</option><option value="4">Four corners</option></select></label><button onClick={()=>set({...layout,widths:[1/3,1/3,1/3],halves:[.5,.5],top:.5})}>Equal sizes</button><button onClick={()=>select(null)}>Done</button></section></div>}
    </main>
}
