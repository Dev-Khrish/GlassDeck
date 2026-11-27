'use client'
import { useEffect,useState } from 'react'
export function SpotifySettings({onBack}:{onBack:()=>void}){
  const [view,setView]=useState('poster')
  const [status,setStatus]=useState('')
  useEffect(()=>{try{setView(localStorage.getItem('spotify-default-view')==='lyrics'?'lyrics':'poster')}catch{}},[])
  return <section className="alternate-view spotify-settings"><h2>Spotify settings</h2>
    <p>Playback and cover art come from the Spotify desktop app on your laptop.</p>
    <label>Default view <select value={view} onChange={e=>{const next=e.target.value;try{localStorage.setItem('spotify-default-view',next);setView(next);setStatus('Saved on this display')}catch{setStatus('Could not save settings')}}}><option value="poster">Music profile</option><option value="lyrics">Lyrics</option></select></label>
    <p>This preference is saved on this display only.</p>
    <button className="subtle-button" onClick={onBack}>Back to Control Centre</button>{status&&<p role="status">{status}</p>}
  </section>
}
