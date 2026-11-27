'use client'
import { useEffect,useState,useRef, type CSSProperties } from 'react'
import { Play, Pause, RefreshCw, SkipBack, SkipForward } from 'lucide-react'
type Track={connected:boolean;title?:string;artist?:string;album?:string;art?:string;playing?:boolean;position?:number;duration?:number;sampledAt?:number}
function parseLyrics(text:string){
  return text.split(/\r?\n/).flatMap(line=>{
    const timestamps=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    const words=line.replace(/\[[^\]]+\]/g,'').trim()
    return words?timestamps.map(match=>({time:60*Number(match[1])+Number(match[2]),words})):[]
  }).sort((a,b)=>a.time-b.time)
}
function timeLabel(seconds:number){
  const n=Math.floor(seconds)
  return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')
}
export function SpotifyWidget(){
  const [track,set]=useState<Track|null>(null),[error,fail]=useState(''),[busy,lock]=useState(false),[artFailed,setArtFailed]=useState(false)
  const seq=useRef(0),writing=useRef(false)
  async function refresh(action?:string){
    if(writing.current)return
    if(action){writing.current=true;lock(true)}
    const n=++seq.current
    try{const r=await fetch('/api/spotify'+(action?'?action='+action:''),{method:action?'POST':'GET',cache:'no-store'})
      if(!r.ok)throw Error()
      const data=await r.json()
      if(n===seq.current){set(data);fail('')}
    }catch{if(n===seq.current)fail(action?'Control unavailable':'Windows media unavailable')}
    finally{if(action){writing.current=false;lock(false)}}
  }
  useEffect(()=>{void refresh();const id=setInterval(()=>{if(!document.hidden)void refresh()},6000);return()=>{clearInterval(id);seq.current++}},[])
  const [lyrics,toggleLyrics]=useState(false)
  useEffect(()=>{try{toggleLyrics(localStorage.getItem('spotify-default-view')==='lyrics')}catch{}},[])
  const [lines,setLines]=useState<ReturnType<typeof parseLyrics>>([])
  const [automatic,setAutomatic]=useState({synced:"",plain:"",status:""})
  const [editing,edit]=useState(false),[draft,setDraft]=useState('')
  const [now,setNow]=useState(0)
  const activeLine=useRef<HTMLParagraphElement>(null)
  const song=JSON.stringify([track?.artist,track?.title,track?.album])
  const storageKey='glassdeck-lyrics:'+song
  useEffect(()=>{
    try{setLines(parseLyrics(localStorage.getItem(storageKey)||''))}catch{setLines([])}
  },[storageKey])
  useEffect(()=>{
    setAutomatic({synced:'',plain:'',status:''})
    if(!lyrics||!track?.connected||!track.title)return
    const controller=new AbortController()
    setAutomatic({synced:'',plain:'',status:'Finding lyrics…'})
    fetch('/api/spotify?view=lyrics',{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error()
      return response.json()
    }).then(data=>{
      if(!controller.signal.aborted)setAutomatic({synced:data.synced||'',plain:data.plain||'',status:data.instrumental?'Instrumental track':'Lyrics unavailable for this track'})
    }).catch(()=>{
      if(!controller.signal.aborted)setAutomatic({synced:'',plain:'',status:'Lyrics service unavailable'})
    })
    return ()=>controller.abort()
  },[lyrics,song,track?.title,track?.connected])
  const displayedLines=lines.length?lines:parseLyrics(automatic.synced)
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>{if(!document.hidden)setNow(Date.now())},1000);return()=>clearInterval(timer)},[])
  const duration=track?.duration||0
  const position=Math.min(duration||Infinity,Math.max(0,(track?.position||0)+(track?.playing&&track.sampledAt?Math.max(0,now-track.sampledAt)/1000:0)))
  const current=displayedLines.reduce((last,line,i)=>line.time<=position?i:last,-1)
  useEffect(()=>{if(lyrics)activeLine.current?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})},[current,lyrics])
  function saveLyrics(text:string){
    const parsed=parseLyrics(text)
    if(!parsed.length){fail('No timed lyrics found');return}
    setLines(parsed)
    edit(false)
    setDraft('')
    fail('')
    try{localStorage.setItem(storageKey,text)}catch{}
  }
  const art=track?.art
  useEffect(()=>setArtFailed(false),[art])
  const trackTitle=track?.connected?track.title||'Spotify':error?'Spotify is offline':'Waiting for Spotify'
  const artist=track?.connected?track.artist||'Unknown artist':error?'Open Spotify on the paired laptop to show playback.':'Connect the laptop to show the current track.'
  const statusLabel=track?.connected?track.playing?'NOW PLAYING':'PAUSED':error?'LAPTOP OFFLINE':'CONNECTING'
  const statusType=track?.connected?'connected':error?'offline':'connecting'
  const poster=art&&!artFailed?art:'/spotify-fallback-cover.png'
  const cover=(className:string,decorative=false)=><div className={className}>{art&&!artFailed?<img key={art.slice(-100)} src={art} alt={decorative?'':`Album artwork for ${trackTitle}`} onError={()=>setArtFailed(true)} decoding="async"/>:<img src="/spotify-fallback-cover.png" alt={decorative?'':'Atmospheric album artwork'} decoding="async"/>}</div>
  return <section aria-label="Spotify player" data-status={statusType} className={'screen-panel spotify-widget '+(lyrics?'with-lyrics':'poster-mode')} style={{'--spotify-cover':`url("${poster}")`} as CSSProperties}>
    <div className="spotify-top"><div className="spotify-player-heading"><i className="spotify-dot" aria-hidden="true"/><div className="spotify-heading-copy"><span className="spotify-kicker">GLASSDECK AUDIO</span><strong>Spotify</strong></div><span className="spotify-status-label" aria-live="polite">{statusLabel}</span></div><div className="spotify-top-actions"><div className="spotify-switch" role="group" aria-label="Spotify view"><button aria-pressed={lyrics} onClick={()=>toggleLyrics(true)}>Lyrics</button><button aria-pressed={!lyrics} onClick={()=>toggleLyrics(false)}>Music profile</button></div><button className="spotify-refresh" aria-label="Refresh Spotify status" onClick={()=>void refresh()}><RefreshCw /></button></div></div>
    <div className="spotify-compact-track">{cover('spotify-mini-cover',true)}<div><strong>{trackTitle}</strong><small>{artist}</small></div><span aria-hidden="true" className={'spotify-eq'+(track?.playing?' playing':'')}><i/><i/><i/><i/></span></div>
    <div className="spotify-composition" key={lyrics?'lyrics':'poster'}>
      <div className="spotify-player">
        {cover('spotify-art')}
        <div className="spotify-info"><h2>{trackTitle}</h2><p>{artist}</p>{track?.connected&&track.album&&<small>{track.album}</small>}</div>
        <div className="spotify-transport">
          {duration>0&&<div className="spotify-timeline"><span>{timeLabel(position)}</span><progress aria-label="Playback progress" value={position} max={duration}/><span>{timeLabel(duration)}</span></div>}
          <div className="spotify-controls">
            <button aria-label="Previous track" disabled={!track?.connected||busy} onClick={()=>refresh('previous')}><SkipBack/></button>
            <button aria-label={track?.playing?'Pause':'Play'} disabled={!track?.connected||busy} onClick={()=>refresh(track?.playing?'pause':'play')}>{track?.playing?<Pause/>:<Play/>}</button>
            <button aria-label="Next track" disabled={!track?.connected||busy} onClick={()=>refresh('next')}><SkipForward/></button>
          </div>
          {error&&<small role="status">{error}</small>}
        </div>
      </div>
      {lyrics&&<div className="spotify-lyrics">
        {displayedLines.length?<div className="spotify-lines">{displayedLines.map((line,i)=><p key={i} ref={i===current?activeLine:null} data-current={i===current}>{line.words}</p>)}</div>:automatic.plain?<div className="spotify-lines" style={{whiteSpace:"pre-line"}}>{automatic.plain}</div>:<p role="status">{track?.connected?automatic.status||'No lyrics found for this track.':error?'Connect Spotify on the paired laptop to load lyrics.':'Waiting for Spotify on the paired laptop.'}</p>}
        {editing?<div className="spotify-lyric-editor">
          <textarea aria-label="Timed lyrics" placeholder="[00:12.00] Paste timed lyrics" value={draft} maxLength={262144} onChange={e=>setDraft(e.target.value)}/>
          <button onClick={()=>saveLyrics(draft)}>Save</button> <button onClick={()=>edit(false)}>Cancel</button>
        </div>:<div><label className="spotify-lyrics-file">{lines.length?'Replace lyrics':'Load .lrc'}<input type="file" accept=".lrc,text/plain" disabled={!track?.connected} onChange={async e=>{
          const file=e.target.files?.[0]
          if(file&&file.size<=262144)saveLyrics(await file.text())
        }}/></label> <button className="spotify-lyrics-file" disabled={!track?.connected} onClick={()=>edit(true)}>Paste lyrics</button></div>}
      </div>}
    </div>
  </section>
}
