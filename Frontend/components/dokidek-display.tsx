'use client'

import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { SpotifySettings } from './spotify-settings'
import { SpotifyWidget } from './spotify-widget'
import { ResizeRow } from './resize-row'
import '@/app/tablet/touch.css'
import type { WidgetMetadata } from '@/lib/widget-metadata'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  Home,
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
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react'

type View = 'Home' | 'Control centre' | 'Widgets' | 'Scenes' | 'Notifications' | 'Spotify settings' | 'Display'
type Scene = { name: string; detail: string; icon: typeof Gamepad2; color: string }
type Channel = { name: string; detail: string; icon: typeof Volume2; color: string; value: number }

const views: View[] = ['Home', 'Control centre', 'Widgets', 'Scenes', 'Notifications']
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
const icons = { Radio, Music2, Gamepad2, SlidersHorizontal, Activity, Sparkles, Clock3, Bell, AudioLines, MonitorPlay, Play, RotateCcw, Headphones, Home }
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

function HomeView({ clock, onNavigate, onOpenPanel }: { clock: string; onNavigate: (view: View) => void; onOpenPanel: () => void }) {
  const [theme, setTheme] = useState('alpine')
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  const backgrounds = [{ id: 'alpine', label: 'Alpine' }, { id: 'sage', label: 'Sage' }, { id: 'dusk', label: 'Dusk' }]
  return <section className={`home-view home-theme-${theme}`} aria-label="GlassDeck home">
    <div className="home-welcome"><span className="micro-label">YOUR DESK, AT A GLANCE</span><h1>Make room for focus.</h1><p>{date} <span>·</span> Your space is ready when you are.</p><div className="home-background-picker" role="group" aria-label="Home background"><span>BACKGROUND</span>{backgrounds.map(background => <button key={background.id} className={theme === background.id ? 'background-active' : ''} aria-pressed={theme === background.id} onClick={() => setTheme(background.id)}>{background.label}</button>)}</div></div>
    <div className="home-hero">
      <div className="home-clock"><span className="micro-label">LOCAL TIME</span><time>{clock}</time><span>{date}</span></div>
      <div className="home-weather"><span className="weather-orb" aria-hidden="true"/><div><span className="micro-label">WEATHER · SET YOUR CITY</span><strong>--°</strong><span>Connect a forecast widget</span></div></div>
      <div className="home-hero-actions"><button className="home-primary" onClick={() => onNavigate('Control centre')}><LayoutGrid /> Open control centre <ChevronRight /></button><button className="home-secondary" onClick={onOpenPanel}><SlidersHorizontal /> Quick settings</button></div>
    </div>
    <div className="home-section-heading"><div><span className="micro-label">PICK UP WHERE YOU LEFT OFF</span><h2>Your deck</h2></div><button className="home-link" onClick={() => onNavigate('Widgets')}>Manage widgets <ChevronRight /></button></div>
    <div className="home-shortcuts">
      <button className="home-shortcut shortcut-scenes" onClick={() => onNavigate('Scenes')}><span className="home-shortcut-icon"><Sparkles /></span><span><strong>Scenes</strong><small>One tap to switch your setup</small></span><ChevronRight /></button>
      <button className="home-shortcut shortcut-audio" onClick={() => onNavigate('Control centre')}><span className="home-shortcut-icon"><Waves /></span><span><strong>Audio mixer</strong><small>Colorful channel controls</small></span><ChevronRight /></button>
      <button className="home-shortcut shortcut-music" onClick={() => onNavigate('Control centre')}><span className="home-shortcut-icon"><Music2 /></span><span><strong>Spotify</strong><small>Now playing and lyrics</small></span><ChevronRight /></button>
    </div>
    <div className="home-footnote"><span className="footer-online-dot"/> Connected devices <strong>Windows host · Tablet display</strong><button onClick={() => onNavigate('Notifications')}><Bell /> Notification layouts</button></div>
  </section>
}

function QuickPanel({ onNavigate, onClose, onSettings, onExtended }: { onNavigate: (view: View) => void; onClose: () => void; onSettings: () => void; onExtended: () => void }) {
  const navigate = (view: View) => { onNavigate(view); onClose() }
  return <div className="quick-panel-backdrop" onClick={onClose}><section className="quick-panel" aria-label="Quick panel" onClick={event => event.stopPropagation()}><div className="quick-panel-grabber"/><div className="quick-panel-header"><div><span className="micro-label">GLASSDECK QUICK PANEL</span><strong>Everything, one swipe away.</strong></div><button className="plain-icon" onClick={onClose} aria-label="Close quick panel"><X/></button></div><div className="quick-panel-sections"><section><span className="micro-label">DISPLAY</span><button onClick={() => navigate('Home')}><Home/> Home screen</button><button onClick={() => navigate('Control centre')}><LayoutGrid/> Control centre</button><button onClick={onExtended}><MonitorPlay/> Normal display <span className="quick-panel-subtitle">Use this screen as an extended display</span></button></section><section><span className="micro-label">WIDGETS</span><button onClick={() => navigate('Widgets')}><Plus/> Add or arrange widgets</button><button onClick={() => navigate('Scenes')}><Sparkles/> Scenes and profiles</button><button onClick={() => navigate('Notifications')}><Bell/> Notification layouts</button></section><section><span className="micro-label">SETTINGS</span><button onClick={onSettings}><Settings2/> App settings</button><button onClick={() => navigate('Spotify settings')}><Music2/> Spotify preferences</button><button onClick={() => navigate('Notifications')}><CircleHelp/> App & event behavior</button></section></div></section></div>
}

function NotificationLayouts() {
  const [selected, setSelected] = useState('App opened')
  const [trigger, setTrigger] = useState('app-open')
  const [action, setAction] = useState('show-card')
  const [enabled, setEnabled] = useState(true)
  const layouts = [
    { name: 'App opened', detail: 'A launch alert expands from the center dock.', kind: 'notification-launch', icon: <Play /> },
    { name: 'Stream event', detail: 'A compact live badge with a status pulse.', kind: 'notification-live', icon: <Radio /> },
    { name: 'Message received', detail: 'A calm card preview with sender and reply action.', kind: 'notification-message', icon: <Bell /> },
    { name: 'System alert', detail: 'A minimal edge toast for device and performance events.', kind: 'notification-system', icon: <Activity /> },
  ]
  return <div className="alternate-view notifications-view"><div className="alternate-heading"><div><span className="micro-label">MOTION & MOMENTS</span><h2>Notification layouts</h2><p>Choose how app launches and system events should arrive on your display.</p></div></div><div className="notification-layout-grid">{layouts.map(layout => <button className={`notification-layout ${selected === layout.name ? 'notification-layout-active' : ''}`} key={layout.name} onClick={() => setSelected(layout.name)} aria-pressed={selected === layout.name}><span className={`notification-preview ${layout.kind}`}><i className="notification-orbit"/><span className="notification-demo-icon">{layout.icon}</span><span className="notification-demo-copy"><b>{layout.name === 'App opened' ? 'Spotify is ready' : layout.name}</b><small>{layout.name === 'App opened' ? 'Tap to open · just now' : 'GlassDeck · moments ago'}</small></span><span className="notification-demo-dot"/></span><span className="notification-layout-copy"><strong>{layout.name}</strong><small>{layout.detail}</small></span></button>)}</div><div className="notification-event-row"><label className="notification-setting"><span className="micro-label">TRIGGER</span><strong>When should this appear?</strong><select className="notification-event-select" value={trigger} onChange={event => setTrigger(event.target.value)}><option value="app-open">When an app opens</option><option value="stream-live">When a stream starts or ends</option><option value="clip-saved">When a 30-second clip is saved</option><option value="new-message">When a new message arrives</option><option value="track-change">When the track changes</option><option value="system-alert">For system alerts</option></select></label><button className={`switch ${enabled ? 'switch-on' : ''}`} role="switch" aria-checked={enabled} aria-label="Enable this notification" onClick={() => setEnabled(!enabled)}><i/></button></div><div className="notification-event-row"><label className="notification-setting"><span className="micro-label">ACTION</span><strong>Then GlassDeck should</strong><select className="notification-event-select" value={action} onChange={event => setAction(event.target.value)}><option value="show-card">Show the selected notification</option><option value="open-app">Open the related app</option><option value="switch-scene">Switch to a scene</option><option value="play-sound">Play a sound effect</option><option value="save-clip">Save the last 30 seconds</option></select></label><div className="notification-motion"><span>Expand from center</span><button className="subtle-button" onClick={() => setSelected('App opened')}>Preview motion <Sparkles /></button></div></div></div>
}

function WidgetView({ enabled, toggleWidget }: { enabled: Record<string, boolean>; toggleWidget: (name: string) => void }) {
  const widgetSeeds = useContext(Catalog)
  const [query, setQuery] = useState('')
  const groups = [
    { name: 'Control & stream', ids: ['stream-deck', 'obs-control', 'twitch-live', 'youtube-live', 'stream-chat', 'stream-timer', 'gameplay-clips', 'soundboard'] },
    { name: 'Media & communication', ids: ['now-playing', 'video-player', 'youtube-browser', 'discord', 'whatsapp', 'friends-map'] },
    { name: 'System & everyday', ids: ['audio-mixer', 'game-status', 'performance-monitor', 'clock', 'clock-weather', 'weather', 'countdown', 'notification-studio', 'extended-display', 'notifications'] },
  ].map(group => ({ ...group, widgets: widgetSeeds.filter(widget => group.ids.includes(widget.id) && `${widget.name} ${widget.description}`.toLowerCase().includes(query.toLowerCase())) })).filter(group => group.widgets.length)
  return <div className="alternate-view"><div className="alternate-heading"><div><span className="micro-label">YOUR DISPLAY, YOUR RULES</span><h2>Widgets</h2><p>Browse your tools by what they help you do. Add the pieces you want in your GlassDeck.</p></div><label className="widget-search"><Search /><span className="sr-only">Search widgets</span><input value={query} placeholder="Search widgets" onChange={event => setQuery(event.target.value)} /></label></div><div className="widget-library-sections">{groups.map(group => <section className="widget-library-section" key={group.name}><div className="widget-library-section-heading"><h3>{group.name}</h3><span>{group.widgets.length} widgets</span></div><div className="widget-library-grid">{group.widgets.map(widget => { const Icon = widget.icon; const isEnabled = enabled[widget.name] ?? widget.enabled; return <article className={`widget-library-card ${isEnabled ? 'widget-library-active' : ''}`} key={widget.id} data-search={`${widget.name} ${widget.description}`.toLowerCase()}><div className="widget-card-top"><span className={`widget-library-icon tone-${widget.color}`}><Icon /></span><button className={`switch ${isEnabled ? 'switch-on' : ''}`} role="switch" aria-checked={isEnabled} aria-label={`${isEnabled ? 'Remove' : 'Add'} ${widget.name}`} onClick={() => toggleWidget(widget.name)}><i /></button></div><h3>{widget.name}</h3><p>{widget.description}</p><div className="widget-card-bottom"><span>{isEnabled ? 'IN YOUR DECK' : 'AVAILABLE'}</span><span className="widget-drag" aria-hidden="true">⠿</span></div></article> })}</div></section>)}</div></div>
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
            <div className="preview-topline"><span>◆ GLASSDECK</span><span>12:48 AM</span></div>
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
  const [view, setView] = useState<View>('Home')
  const [activeScene, setActiveScene] = useState('Gameplay')
  const [channelValues, setChannelValues] = useState(channels)
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>({})
  const [chat, setChat] = useState(initialChat)
  const [playing, setPlaying] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [clock, setClock] = useState('--:--')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickPanelOpen, setQuickPanelOpen] = useState(false)
  const swipeStart = useRef<number | null>(null)
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

  const selectView = (next: View) => { setView(next); setSettingsOpen(false); setQuickPanelOpen(false) }
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => { swipeStart.current = event.clientY }
  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (swipeStart.current !== null && event.clientY - swipeStart.current > 72 && swipeStart.current < 56) setQuickPanelOpen(true)
    swipeStart.current = null
  }

  return <main className={tablet ? "display-app tablet-centre" : "display-app"} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
    <div className={'device-shell'+(view==='Control centre'?' widget-surface':'')}>
      {view !== 'Display' && <header className="display-header"><Brand /><nav className="primary-nav" aria-label="GlassDeck navigation">{views.map((item) => <button key={item} className={`display-tab ${view === item ? 'tab-active' : ''}`} onClick={() => selectView(item)} aria-current={view === item ? 'page' : undefined}>{item === 'Home' ? <Home /> : item === 'Control centre' ? <Activity /> : item === 'Widgets' ? <LayoutGrid /> : item === 'Scenes' ? <MonitorPlay /> : <Bell />}{item === 'Control centre' ? 'Control centre' : item === 'Notifications' ? 'Alerts' : item}{item === 'Widgets' && <span className="tab-count">{widgetSeeds.filter((widget) => enabledWidgets[widget.name] ?? widget.enabled).length}</span>}</button>)}</nav><div className="header-tools"><span className="header-clock">{clock}</span><button className="header-icon quick-panel-trigger" aria-label="Open quick panel" aria-expanded={quickPanelOpen} onClick={() => setQuickPanelOpen(!quickPanelOpen)}><ChevronDown /></button><button className="header-icon" aria-label="Display settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 /></button></div></header>}

      {view === 'Home' && <HomeView clock={clock} onNavigate={selectView} onOpenPanel={() => setQuickPanelOpen(true)} />}
      {view === 'Control centre' && <ResizeRow onManage={()=>selectView('Widgets')}><section className="screen-panel modes-panel" aria-labelledby="modes-heading"><div className="panel-heading"><div><span className="micro-label">ONE TAP. YOUR WHOLE SETUP.</span><h2 id="modes-heading">Scenes <span className="scene-count">06</span></h2></div><button className="plain-icon" aria-label="Open all scenes" onClick={() => selectView('Scenes')}><Maximize2 /></button></div><div className="mode-grid">{scenes.map((scene) => <SceneCard key={scene.name} scene={scene} selected={activeScene === scene.name} onSelect={() => { setActiveScene(scene.name); setNotification(`${scene.name} scene activated`) }} />)}</div><div className="modes-footer"><span><span className="route-dot" /> READY TO SWITCH</span><button onClick={() => selectView('Scenes')}>Manage scenes <ChevronRight /></button></div></section>
        <ChatPanel messages={chat} onSend={(message) => setChat((current) => [...current, { user: 'you', message, color: 'blue' }])} />
        <Mixer values={channelValues} setValues={setChannelValues} muted={muted} toggleMute={toggleMute} />
        <SpotifyWidget /></ResizeRow>}
      {view === 'Spotify settings' && <SpotifySettings onBack={()=>selectView('Control centre')} />}
      {view === 'Widgets' && <WidgetView enabled={enabledWidgets} toggleWidget={toggleWidget} />}
      {view === 'Scenes' && <SceneView selected={activeScene} onSelect={(scene) => { setActiveScene(scene); setNotification(`${scene} scene activated`) }} />}
      {view === 'Notifications' && <NotificationLayouts />}
      {view === 'Display' && <section className="extended-display" aria-label="Extended display mode"><div className="extended-display-top"><span className="display-brand"><span className="display-brand-symbol" aria-hidden="true"><i/><i/><i/></span>GLASSDECK DISPLAY</span><button className="subtle-button" onClick={() => selectView('Home')}><X/> Exit display</button></div><div className="extended-display-center"><span className="micro-label">SECOND SCREEN</span><time>{clock}</time><span>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><div className="extended-display-widgets"><span>Spotify <strong>Ready</strong></span><span>System <strong>Connected</strong></span><span>Next scene <strong>{activeScene}</strong></span></div></div></section>}

      {settingsOpen && <div className="settings-popover"><div className="settings-popover-head"><span>DISPLAY SETTINGS</span><button className="plain-icon" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X /></button></div><button onClick={()=>{setSettingsOpen(false);setView('Spotify settings')}}><span><Music2 /> Spotify</span><ChevronRight /></button><button onClick={() => setNotification('Brightness settings are ready')}><span><Sparkles /> Brightness</span><span>82%</span></button><button onClick={() => { setSettingsOpen(false); setView('Display') }}><span><Maximize2 /> Normal display</span><span>Preview</span></button><button onClick={() => setNotification('Display sleep timer is off')}><span><Clock3 /> Sleep timer</span><span>Off</span></button></div>}
      {quickPanelOpen && <QuickPanel onNavigate={selectView} onClose={() => setQuickPanelOpen(false)} onSettings={() => { setQuickPanelOpen(false); setSettingsOpen(true) }} onExtended={() => selectView('Display')} />}
      {notification && <div className="display-toast" role="status"><span className="toast-check">✓</span>{notification}</div>}
    </div>
  </main>
}
