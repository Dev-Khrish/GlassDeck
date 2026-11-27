'use client'
import { useEffect } from 'react'
export function WatchVersion({version}:{version:string}) {
  useEffect(()=>{
    let disposed=false, busy=false, touching=false
    const down=()=>{touching=true}, up=()=>{touching=false}
    const check=async()=>{
      if(busy||document.hidden||touching)return
      busy=true
      try {
        const response=await fetch('/api/tablet-health',{cache:'no-store',signal:AbortSignal.timeout(4500)})
        const current=response.headers.get('X-Dashboard-Version')
        if(!disposed && response.ok && current && current!==version && !touching &&
          !document.activeElement?.matches('input:not([type=range]),textarea,[contenteditable=true]')) location.reload()
      } catch {} finally {busy=false}
    }
    window.addEventListener('pointerdown',down,true)
    window.addEventListener('pointerup',up,true)
    window.addEventListener('pointercancel',up,true)
    document.addEventListener('visibilitychange',check)
    const timer=setInterval(check,5000)
    return ()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true)}
  },[version])
  return null
}
