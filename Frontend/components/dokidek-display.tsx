'use client'

import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { SpotifySettings } from './spotify-settings'
import { SpotifyWidget } from './spotify-widget'
import { ResizeRow } from './resize-row'
import '@/app/tablet/touch.css'
import type { WidgetMetadata } from '@/lib/widget-metadata'
import type { CSSProperties, FormEvent } from 'react'
import {
  Activity,
  AudioLines,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Gamepad2,
  Headphones,
  LayoutGrid,
  Maximize2,
  Mic2,
  MicOff,
  MonitorPlay,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react'

type View = 'Control centre' | 'Widgets' | 'Scenes' | 'Spotify settings'
type Scene = { name: string; detail: string; icon: typeof Gamepad2; color: string }
type Channel = { name: string; detail: string; icon: typeof Volume2; color: string; value: number }

const views: View[] = ['Control centre', 'Widgets', 'Scenes']
const scenes: Scene[] = [
  { name: 'Gameplay', detail: 'Game · Cam', icon: Gamepad2, color: 'mint' },
  { name: 'Just Chatting', detail: 'Cam · Chat', icon: Radio, color: 'blue' },
  { name: 'Starting Soon', detail: 'Countdown', icon: Clock3, color: 'amber' },
  { name: 'Be Right Back', detail: 'Lo-fi loop', icon: AudioLines, color: 'orange' },
  { name: 'Mic check', detail: 'Headset mic', icon: Mic2, color: 'yellow' },
  { name: 'Replay', detail: 'Last 30 sec', icon: RotateCcw, color: 'green' },
]
const channels: Channel[] = [
  { name: 'Master', detail: 'Headset · USB audio', icon: Headphones, color: 'master', value: 72 },
  { name: 'Game', detail: 'Playing · The Witcher 3', icon: Gamepad2, color: 'mint', value: 64 },
  { name: 'Discord', detail: 'Voice · 3 in call', icon: Radio, color: 'blue', value: 50 },
  { name: 'Music', detail: 'Lo-fi beats · playing', icon: Music2, color: 'orange', value: 36 },
  { name: 'Mic', detail: 'Headset microphone', icon: Mic2, color: 'yellow', value: 86 },
]
const initialChat = [
  { user: 'lowkeyjin', message: 'clean setup, what is that little screen?', color: 'green' },
  { user: 'kairo', message: '1v3 with 12 hp LMAO', color: 'amber' },
  { user: 'drift', message: 'CLIP THAT', color: 'blue' },
  { user: 'neonwolf', message: 'that last fight was so clean', color: 'orange' },
  { user: 'ollie', message: 'what are we playing next?', color: 'pink' },
  { user: 'NovaFrag', message: 'W streamer', color: 'green' },
  { user: 'tessa_gg', message: 'the audio setup is so satisfying', color: 'purple' },
]
const icons = { Radio, Music2, Gamepad2, SlidersHorizontal, Activity, Sparkles, Clock3, Bell }
type Widget = Omit<WidgetMetadata, "icon"> & { icon: typeof Radio }
const Catalog = createContext<Widget[]>([])


function Brand() {
  return <div className="display-brand"><span className="display-brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>GLASSDECK</span></div>
}

function SceneCard({ scene, selected, onSelect }: { scene: Scene; selected: boolean; onSelect: () => void }) {
  const Icon = scene.icon
  return <button className={`mode-card ${selected ? 'mode-card-active' : ''}`} onClick={onSelect} aria-pressed={selected}><span className={`mode-icon tone-${scene.color}`}><Icon /></span><span className="mode-name">{scene.name}</span><span className="mode-detail">{scene.detail}</span>{selected && <span className="active-signal"><i /> LIVE</span>}</button>
}

function Mixer({ values, setValues, muted, toggleMute }: { values: Channel[]; setValues: (next: Channel[]) => void; muted: Record<string, boolean>; toggleMute: (name: string) => void }) {
  return <section className="screen-panel mixer-panel" aria-labelledby="mixer-heading"><div className="panel-heading"><div><span className="micro-label">OUTPUT & INPUT</span><h2 id="mixer-heading"><Headphones /> Audio mixer <ChevronDown /></h2></div><button className="plain-icon" aria-label="Mixer settings"><Settings2 /></button></div><div className="mixer-channels">{values.map((channel) => { const Icon = channel.icon; const mutedChannel = muted[channel.name]; return <div className={`mixer-channel ${mutedChannel ? 'channel-muted' : ''}`} key={channel.name}><button className={`channel-icon tone-${channel.color}`} onClick={() => toggleMute(channel.name)} aria-label={`${mutedChannel ? 'Unmute' : 'Mute'} ${channel.name}`} aria-pressed={mutedChannel}>{mutedChannel ? <VolumeX /> : <Icon />}</button><div className="channel-copy"><strong>{channel.name}</strong><span>{channel.detail}</span></div><div className="channel-meter-wrap"><input type="range" min="0" max="100" value={mutedChannel ? 0 : channel.value} aria-label={`${channel.name} volume`} onChange={(event) => setValues(values.map((item) => item.name === channel.name ? { ...item, value: Number(event.target.value) } : item))} style={{ '--level': `${mutedChannel ? 0 : channel.value}%` } as CSSProperties} /><div className={`level-bars bars-${channel.color}`} aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} className={index < Math.round((mutedChannel ? 0 : channel.value) / 4.2) ? 'bar-on' : ''} />)}</div></div><span className="channel-value">{mutedChannel ? '—' : channel.value}</span></div> })}</div><div className="mixer-footer"><span><span className="route-dot" /> Headset · USB audio</span><button className="footer-select">Stream mix <ChevronDown /></button></div></section>
}

function ChatPanel({ messages, onSend }: { messages: typeof initialChat; onSend: (message: string) => void }) {
  const [draft, setDraft] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message) return
    onSend(message)
    setDraft('')
  }
  return <section className="screen-panel chat-panel" aria-labelledby="chat-heading"><div className="panel-heading"><div><span className="micro-label">STREAM CHAT</span><h2 id="chat-heading"><span className="chat-heading-dot" /> Twitch chat <span className="viewer-count">1,284 watching</span></h2></div><div className="chat-actions"><button className="plain-icon" aria-label="Chat notifications"><Bell /></button><button className="plain-icon" aria-label="Chat settings"><Settings2 /></button></div></div><div className="chat-toolbar"><span><i /> LIVE</span><span>TOP CHAT</span><button aria-label="Chat options">•••</button></div><div className="chat-messages" aria-live="polite">{messages.map((chat, index) => <div className="chat-message" key={`${chat.user}-${index}`}><span className={`chat-user user-${chat.color}`}>{chat.user}</span><span className="chat-text">{chat.message}</span>{index === 2 && <span className="chat-reaction">✦</span>}</div>)}</div><form className="chat-composer" onSubmit={submit}><label htmlFor="chat-draft" className="sr-only">Write a chat message</label><input id="chat-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Send a message..." maxLength={140} /><button type="submit" disabled={!draft.trim()} aria-label="Send chat message"><ChevronRight /></button></form></section>
}

function StreamCard({ selectedScene }: { selectedScene: string }) {
  return <section className="screen-panel stream-panel" aria-label="Stream status"><div className="stream-panel-head"><div><span className="micro-label">STREAMING</span><h2><span className="obs-mark"><MonitorPlay /></span> OBS Studio <span className="connected-badge"><i /> CONNECTED</span></h2></div><button className="panel-menu" aria-label="More stream options">•••</button></div><div className="stream-stat-grid"><div className="stream-stat"><span className="stream-live-label"><i /> LIVE</span><strong>1:24:16</strong><span className="stat-caption">STREAM DURATION</span></div><div className="stream-stat"><span className="micro-label">BITRATE</span><strong>6,022 <small>kbps</small></strong><span className="stat-caption">STABLE · 60 FPS</span></div></div><div className="stream-wave" aria-label="Stream activity visualization">{Array.from({ length: 48 }, (_, index) => <i key={index} style={{ '--bar-height': `${20 + ((index * 19 + 17) % 78)}%` } as CSSProperties} />)}</div><div className="stream-bottom"><span>ACTIVE SCENE</span><strong>{selectedScene}</strong><button aria-label="Switch active scene"><ChevronRight /></button></div></section>
}

function NowPlaying({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return <section className="screen-panel now-playing-panel" aria-label="Now playing"><div className="panel-heading"><div><span className="micro-label">NOW PLAYING</span><h2><Music2 /> Music</h2></div><button className="plain-icon" aria-label="More music options"><Settings2 /></button></div><div className="track-layout"><div className="album-cover"><span className="cover-sun" /><span className="cover-horizon" /><span className="cover-word">M83</span></div><div className="track-details"><strong>Midnight City</strong><span>M83 · Hurry Up, We&apos;re Dreaming</span><div className="track-progress"><i style={{ width: playing ? '58%' : '36%' }} /></div><div className="track-times"><span>{playing ? '2:14' : '1:02'}</span><span>4:03</span></div><div className="track-controls"><button aria-label="Previous track"><ChevronLeft /></button><button className="play-button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause /> : <Play />}</button><button aria-label="Next track"><ChevronRight /></button><span className="track-volume"><Volume2 /> 68%</span></div></div></div></section>
}

function WidgetView({ enabled, toggleWidget }: { enabled: Record<string, boolean>; toggleWidget: (name: string) => void }) {
  const widgetSeeds = useContext(Catalog)
  return <div className="alternate-view"><div className="alternate-heading"><div><span className="micro-label">YOUR DISPLAY, YOUR RULES</span><h2>Widgets</h2><p>Choose what stays on your DokiDek. Turn a widget on to add it to your display.</p></div></div><div className="widget-library-grid">{widgetSeeds.map((widget) => { const Icon = widget.icon; const isEnabled = enabled[widget.name] ?? widget.enabled; return <article className={`widget-library-card ${isEnabled ? 'widget-library-active' : ''}`} key={widget.name}><div className="widget-card-top"><span className={`widget-library-icon tone-${widget.color}`}><Icon /></span><button className={`switch ${isEnabled ? 'switch-on' : ''}`} role="switch" aria-checked={isEnabled} aria-label={`${isEnabled ? 'Remove' : 'Add'} ${widget.name}`} onClick={() => toggleWidget(widget.name)}><i /></button></div><h3>{widget.name}</h3><p>{widget.description}</p><div className="widget-card-bottom"><span>{isEnabled ? 'ON DISPLAY' : 'AVAILABLE'}</span><span className="widget-drag">⠿</span></div></article> })}</div></div>
}

function SceneView({ selected, onSelect }: { selected: string; onSelect: (scene: string) => void }) {
  const [slide, setSlide] = useState(0)
  const active = scenes[slide]
  const ActiveIcon = active.icon
  const changeSlide = (direction: number) => setSlide((current) => (current + direction + scenes.length) % scenes.length)

  return (
    <div className="alternate-view scenes-view">
      <div className="alternate-heading">
        <div>
          <span className="micro-label">ONE TAP. WHOLE SETUP.</span>
          <h2>Scenes</h2>
          <p>Switch your widgets, audio, and screen layout together.</p>
        </div>
        <div className="scene-view-controls">
          <button className="subtle-button" onClick={() => onSelect(selected)}><Sparkles /> Active: {selected}</button>
        </div>
      </div>
      <div className="scene-feature">
        <button className="scene-arrow" aria-label="Previous scene" onClick={() => changeSlide(-1)}><ChevronLeft /></button>
        <div className={`scene-feature-art scene-art-${active.color}`} key={active.name}>
          <div className="scene-ambient" />
          <div className="scene-preview-window">
            <div className="preview-topline"><span>◆ DOKIDEK</span><span>12:48 AM</span></div>
            <div className="preview-scene-icon"><ActiveIcon /></div>
            <strong>{active.name}</strong>
            <span>{active.detail} · ready when you are</span>
            <div className="preview-pills"><i /><i /><i /></div>
          </div>
          <div className="scene-feature-caption">
            <span className="micro-label">SCENE {String(slide + 1).padStart(2, '0')} / 06</span>
            <h3>{active.name}</h3>
            <p>{active.name === 'Gameplay' ? 'Game audio up. Chat in view. Stay in the match.' : active.name === 'Just Chatting' ? 'Camera, chat, and your community in one glance.' : `Your ${active.name.toLowerCase()} layout, ready with one tap.`}</p>
            <button className="activate-scene" onClick={() => onSelect(active.name)}>{selected === active.name ? 'SCENE ACTIVE' : 'ACTIVATE SCENE'} <ChevronRight /></button>
          </div>
        </div>
        <button className="scene-arrow" aria-label="Next scene" onClick={() => changeSlide(1)}><ChevronRight /></button>
      </div>
      <div className="scene-pager">
        {scenes.map((scene, index) => (
          <button key={scene.name} aria-label={`Show ${scene.name} scene`} aria-current={index === slide ? 'true' : undefined} className={index === slide ? 'pager-active' : ''} onClick={() => setSlide(index)} />
        ))}
      </div>
    </div>
  )
}

function Countdown() {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(60)
  useEffect(() => {
    if (deadline === null) return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(seconds)
      if (!seconds) setDeadline(null)
    }
    tick()
    const interval = window.setInterval(tick, 200)
    return () => window.clearInterval(interval)
  }, [deadline])
  return <section className="bottom-widget"><Clock3 /><div className="bottom-widget-copy"><span>Countdown</span><strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong></div><button className="subtle-button" onClick={() => deadline ? setDeadline(null) : setDeadline(Date.now() + (remaining || 60) * 1000)}>{deadline ? 'Pause' : remaining ? 'Start' : 'Restart'}</button></section>
}

export function DokidekDisplay({ catalog, tablet = false }: { catalog: WidgetMetadata[]; tablet?: boolean }) {
  const widgets = catalog.map(widget => ({ ...widget, icon: icons[widget.icon as keyof typeof icons] || LayoutGrid }))
  return <Catalog.Provider value={widgets}><Dashboard tablet={tablet} /></Catalog.Provider>
}

function Dashboard({ tablet }: { tablet: boolean }) {
  const widgetSeeds = useContext(Catalog)
  const [view, setView] = useState<View>('Control centre')
  const [activeScene, setActiveScene] = useState('Gameplay')
  const [channelValues, setChannelValues] = useState(channels)
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>({})
  const [chat, setChat] = useState(initialChat)
  const [playing, setPlaying] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [clock, setClock] = useState('--:--')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notification, setNotification] = useState('')

  useEffect(() => {
    const updateClock = () => setClock(new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date()))
    updateClock()
    const timer = window.setInterval(updateClock, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notification) return
    const timeout = window.setTimeout(() => setNotification(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [notification])

  const toggleMute = (name: string) => setMuted((current) => ({ ...current, [name]: !current[name] }))
  const pending = useRef(new Set<string>())
  const isEnabled = (name: string) => enabledWidgets[name] ?? widgetSeeds.find(widget => widget.name === name)?.enabled ?? false
  const setWidget = async (name: string, enabled: boolean) => {
    const widget = widgetSeeds.find(item => item.name === name)
    if (!widget || pending.current.has(widget.id) || isEnabled(name) === enabled) return
    pending.current.add(widget.id)
    try {
      const result = await fetch('/api/widget-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: widget.id, enabled }) })
      if (!result.ok) throw Error()
      setEnabledWidgets(current => ({ ...current, [name]: enabled }))
      setNotification(name + (enabled ? ' enabled' : ' disabled'))
    } catch { setNotification('Could not save ' + name + '. Try again.') }
    finally { pending.current.delete(widget.id) }
  }
  const toggleWidget = (name: string) => setWidget(name, !isEnabled(name))

  return <main className={tablet ? "display-app tablet-centre" : "display-app"}>
    <div className={'device-shell'+(view==='Control centre'?' widget-surface':'')}>
      {view !== 'Control centre' && <header className="display-header"><Brand /><div className="header-center"><div className="connection-status"><i /> SYSTEM ONLINE</div><span className="header-separator" /><span className="header-device-name">CONTROL CENTRE</span></div><div className="header-tools"><span className="header-clock">{clock}</span>{isEnabled('Notifications') && <button className="header-icon" aria-label="Notifications" onClick={() => setNotification('You’re all caught up')}><Bell /></button>}<button className="header-icon settings-trigger" aria-label="Settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 /></button><span className="user-badge">DK</span></div></header>}

      {view !== 'Control centre' && <nav className="display-tabs" aria-label="Display sections">{views.map((item) => <button key={item} className={`display-tab ${view === item ? 'tab-active' : ''}`} onClick={() => setView(item)} aria-current={view === item ? 'page' : undefined}>{item === 'Control centre' ? <Activity /> : item === 'Widgets' ? <LayoutGrid /> : item === 'Scenes' ? <MonitorPlay /> : <Sparkles />}{item}{item === 'Widgets' && <span className="tab-count">{widgetSeeds.filter((widget) => enabledWidgets[widget.name] ?? widget.enabled).length}</span>}</button>)}<span className="tab-spacer" /><div className="display-mode"><span className="mode-indicator" /> DESK MODE <ChevronDown /></div></nav>}

      {view === 'Control centre' && <ResizeRow onManage={()=>setView('Widgets')}><section className="screen-panel modes-panel" aria-labelledby="modes-heading"><div className="panel-heading"><div><span className="micro-label">ONE TAP. YOUR WHOLE SETUP.</span><h2 id="modes-heading">Scenes <span className="scene-count">06</span></h2></div><button className="plain-icon" aria-label="Open all scenes" onClick={() => setView('Scenes')}><Maximize2 /></button></div><div className="mode-grid">{scenes.map((scene) => <SceneCard key={scene.name} scene={scene} selected={activeScene === scene.name} onSelect={() => { setActiveScene(scene.name); setNotification(`${scene.name} scene activated`) }} />)}</div><div className="modes-footer"><span><span className="route-dot" /> READY TO SWITCH</span><button onClick={() => setView('Scenes')}>Manage scenes <ChevronRight /></button></div></section>
          <ChatPanel messages={chat} onSend={(message) => setChat((current) => [...current, { user: 'you', message, color: 'blue' }])} />
          <Mixer values={channelValues} setValues={setChannelValues} muted={muted} toggleMute={toggleMute} />
      <SpotifyWidget /></ResizeRow>}
      {view === 'Spotify settings' && <SpotifySettings onBack={()=>setView('Control centre')} />}
      {view === 'Widgets' && <WidgetView enabled={enabledWidgets} toggleWidget={toggleWidget} />}
      {view === 'Scenes' && <SceneView selected={activeScene} onSelect={(scene) => { setActiveScene(scene); setNotification(`${scene} scene activated`) }} />}

      {view !== 'Control centre' && <footer className="display-footer"><span><span className="footer-online-dot" /> ALL SYSTEMS RUNNING</span><div className="footer-center"><span>DO<em>K</em>IDEK</span><i /> <span>YOUR DESK, CONNECTED.</span></div><button className="help-button" onClick={() => setNotification('Help centre is ready for your device')}><CircleHelp /> HELP & SUPPORT</button></footer>}
      {settingsOpen && <div className="settings-popover"><div className="settings-popover-head"><span>DISPLAY SETTINGS</span><button className="plain-icon" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X /></button></div><button onClick={()=>{setSettingsOpen(false);setView('Spotify settings')}}><span><Music2 /> Spotify</span><ChevronRight /></button><button onClick={() => setNotification('Brightness settings are ready')}><span><Sparkles /> Brightness</span><span>82%</span></button><button onClick={() => setNotification('Display orientation set to landscape')}><span><Maximize2 /> Orientation</span><span>Landscape</span></button><button onClick={() => setNotification('Display sleep timer is off')}><span><Clock3 /> Sleep timer</span><span>Off</span></button></div>}
      {notification && <div className="display-toast" role="status"><span className="toast-check">✓</span>{notification}</div>}
    </div>
  </main>
}
