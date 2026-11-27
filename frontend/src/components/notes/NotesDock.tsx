import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { api, post } from '../../lib/api'
import { noteStamp } from '../ui/PlayerNotes'
import { useOpenPlayer } from '../squad/PlayerPopup'
import { useLeague } from '../../contexts/LeagueContext'
import { TeamBadge, useTeamAccent } from '../ui/TeamBadge'
import { clubVars } from '../../lib/clubs'

// The notes panel on My Team (Lucas, 2026-11-27): a button bottom right that
// opens and minimises it. Players (your squad first, then anyone) and general
// notes for this league. A note written on a player's card is the same note.
// Redesigned the same day: "more colour, more modern, more sleek, more
// intuitive, more personable ... collapsed notes by default". Colour only
// where it means something: your team's colour on the panel, each player's
// club colours and his face.
// Data: /api/leagues/<id>/notes, /api/players/search. Styles: .nd-* in static/style.css.

interface Note { id: number; body: string; created_at: string }
interface Card { id: number; name: string; position: string; afl_team: string; is_former?: boolean; photo_url?: string | null }
interface PlayerNotesRow { player: Card; mine: boolean; latest: string; notes: Note[] }
interface Data { general: Note[]; players: PlayerNotesRow[]; squad: Card[] }

const MAX = 2000
const OPEN_KEY = 'kl-notes-open'

function readOpen() { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } }
function keepOpen(v: boolean) { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0') } catch { /* private mode */ } }

/** "Just now", "3 hours ago", "Yesterday", "4 days ago", "20 Nov". */
function ago(iso: string) {
  const t = new Date(iso).getTime()
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s < 7200 ? '' : 's'} ago`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function NoteIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 2.5h7l3 3v8H3z M10 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" /></svg>
}

/** His face on his club's colours; the club logo when we have no photo. */
function Avatar({ c, logos, size = 44 }: { c: Card; logos: Record<string, string>; size?: number }) {
  const [bad, setBad] = useState(false)
  const logo = logos[c.afl_team]
  return (
    <span className="nd-av" style={{ ...clubVars(c.afl_team), width: size, height: size } as CSSProperties}>
      {c.photo_url && !bad
        ? <img src={c.photo_url} alt="" onError={() => setBad(true)} />
        : logo ? <img className="nd-av-logo" src={logo} alt="" /> : <b>{c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</b>}
    </span>
  )
}

function Pos({ p }: { p: string }) {
  const k = (p || 'MID').split('/')[0]
  return <span className={`pos-badge badge-${k.toLowerCase()}`}>{k}</span>
}

function Writer({ placeholder, onSave, autoFocus, label = 'Save note' }: { placeholder: string; onSave: (body: string) => Promise<void>; autoFocus?: boolean; label?: string }) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  // grow with the text
  useEffect(() => { const t = ref.current; if (t) { t.style.height = 'auto'; t.style.height = Math.min(220, t.scrollHeight) + 'px' } }, [draft])
  async function save() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true); setError(null)
    try { await onSave(body); setDraft('') } catch { setError('That note was not saved. Try again.') } finally { setSaving(false) }
  }
  return (
    <div className={'nd-write' + (draft ? ' typing' : '')}>
      <textarea ref={ref} rows={1} value={draft} placeholder={placeholder} aria-label={placeholder}
        onChange={e => setDraft(e.target.value.slice(0, MAX))}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save() }} />
      {draft.trim() && <button type="button" className="nd-save" onClick={save} disabled={saving}>{saving ? 'Saving' : label}</button>}
      {error && <div className="nd-error" role="alert">{error}</div>}
    </div>
  )
}

function Delete({ onDelete }: { onDelete: () => void }) {
  const [ask, setAsk] = useState(false)
  return ask ? (
    <span className="nd-confirm">
      <button type="button" className="nd-del-yes" onClick={onDelete}>Delete</button>
      <button type="button" className="nd-del-no" onClick={() => setAsk(false)}>Keep</button>
    </span>
  ) : <button type="button" className="nd-del" onClick={() => setAsk(true)} aria-label="Delete this note"><i className="bi bi-trash3"></i></button>
}

/** His notes as a timeline, newest first, in his club's colour. */
function Timeline({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  if (!notes.length) return null
  return (
    <ol className="nd-tl">
      {notes.map(n => (
        <li key={n.id}>
          <span className="nd-tl-dot" />
          <div className="nd-tl-top"><time dateTime={n.created_at} title={noteStamp(n.created_at)}>{ago(n.created_at)}</time><Delete onDelete={() => onDelete(n.id)} /></div>
          <p>{n.body}</p>
        </li>
      ))}
    </ol>
  )
}

/** A general note: three lines until opened. */
function GeneralCard({ n, onDelete }: { n: Note; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const long = n.body.length > 160 || n.body.split('\n').length > 3
  return (
    <li className={'nd-gen' + (open ? ' open' : '')}>
      <div className="nd-tl-top"><time dateTime={n.created_at} title={noteStamp(n.created_at)}>{ago(n.created_at)}</time><Delete onDelete={onDelete} /></div>
      <p>{n.body}</p>
      {long && <button type="button" className="nd-more" onClick={() => setOpen(o => !o)}>{open ? 'Show less' : 'Show more'}</button>}
    </li>
  )
}

export function NotesDock({ leagueId }: { leagueId: string }) {
  const { league } = useLeague()
  const accent = useTeamAccent()(league?.user_team?.id)
  const logos = (league?.club_logos || {}) as Record<string, string>
  const [open, setOpen] = useState(readOpen)
  const [tab, setTab] = useState<'players' | 'general'>('players')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Card[]>([])
  const [picked, setPicked] = useState<Card[]>([])
  const openPlayer = useOpenPlayer()

  function load() {
    api<Data>(`/api/leagues/${leagueId}/notes`).then(d => { setData(d); setError(null) })
      .catch(() => setError('Your notes could not be loaded.'))
  }
  useEffect(() => { load() }, [leagueId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!picking || scope !== 'all' || query.trim().length < 2) { setFound([]); return }
    let live = true
    const t = setTimeout(() => {
      api<{ players: Card[] }>(`/api/players/search?q=${encodeURIComponent(query.trim())}`)
        .then(d => { if (live) setFound(d.players) }).catch(() => { if (live) setFound([]) })
    }, 180)
    return () => { live = false; clearTimeout(t) }
  }, [query, scope, picking])

  function toggle(v: boolean) { setOpen(v); keepOpen(v) }

  const rows: PlayerNotesRow[] = useMemo(() => {
    const have = new Set((data?.players || []).map(r => r.player.id))
    const mineIds = new Set((data?.squad || []).map(c => c.id))
    const extra = picked.filter(c => !have.has(c.id)).map(c => ({ player: c, mine: mineIds.has(c.id), latest: '', notes: [] }))
    return [...extra, ...(data?.players || [])]
  }, [data, picked])
  const squadPick = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.squad || []).filter(c => !q || c.name.toLowerCase().includes(q))
  }, [data, query])

  function choose(c: Card) {
    setPicked(p => [c, ...p.filter(x => x.id !== c.id)])
    setExpanded(c.id); setPicking(false); setQuery(''); setFound([])
  }
  async function addGeneral(body: string) {
    const d = await post<{ note: Note }>(`/api/leagues/${leagueId}/notes/general`, { body })
    setData(x => x ? { ...x, general: [d.note, ...x.general] } : x)
  }
  async function delGeneral(id: number) {
    const before = data
    setData(x => x ? { ...x, general: x.general.filter(n => n.id !== id) } : x)
    try { await api(`/api/leagues/${leagueId}/notes/general/${id}`, { method: 'DELETE' }) } catch { setData(before); setError('That note was not deleted. Try again.') }
  }
  async function addPlayer(c: Card, mine: boolean, body: string) {
    const d = await post<{ note: Note }>(`/api/players/${c.id}/notes`, { body })
    setData(x => {
      if (!x) return x
      const cur = x.players.find(r => r.player.id === c.id)
      const row = { player: c, mine, latest: d.note.created_at, notes: [d.note, ...(cur?.notes || [])] }
      return { ...x, players: [row, ...x.players.filter(r => r.player.id !== c.id)] }
    })
    setPicked(p => p.filter(x => x.id !== c.id))
  }
  async function delPlayer(pid: number, id: number) {
    const before = data
    setData(x => x ? { ...x, players: x.players.map(r => r.player.id === pid ? { ...r, notes: r.notes.filter(n => n.id !== id) } : r).filter(r => r.notes.length) } : x)
    try { await api(`/api/players/notes/${id}`, { method: 'DELETE' }) } catch { setData(before); setError('That note was not deleted. Try again.') }
  }

  const playerCount = data?.players.reduce((a, r) => a + r.notes.length, 0) || 0
  const total = (data?.general.length || 0) + playerCount
  const team = { ['--tm' as string]: accent.hex, ['--tm-rgb' as string]: accent.rgb } as CSSProperties

  if (!open) {
    return (
      <button type="button" className="nd-fab" style={team} onClick={() => toggle(true)} aria-label="Open my notes">
        <NoteIcon />
        <span>Notes</span>
        {total > 0 && <em>{total}</em>}
      </button>
    )
  }

  const mineRows = rows.filter(r => r.mine)
  const otherRows = rows.filter(r => !r.mine)
  const rowView = (r: PlayerNotesRow) => {
    const on = expanded === r.player.id
    const last = r.notes[0]
    return (
      <li key={r.player.id} className={'nd-p' + (on ? ' on' : '')} style={clubVars(r.player.afl_team)}>
        <button type="button" className="nd-p-h" onClick={() => setExpanded(on ? null : r.player.id)} aria-expanded={on}>
          <Avatar c={r.player} logos={logos} />
          <span className="nd-p-main">
            <span className="nd-p-name"><b>{r.player.name}</b>{r.notes.length > 0 && <em>{r.notes.length}</em>}</span>
            <span className="nd-p-sub"><Pos p={r.player.position} />{r.player.afl_team}{last ? <span className="nd-p-when">{ago(last.created_at)}</span> : <span className="nd-p-when">New</span>}</span>
            {!on && last && <span className="nd-p-prev">{last.body}</span>}
          </span>
          <i className={`bi bi-chevron-${on ? 'up' : 'down'} nd-p-chev`}></i>
        </button>
        {on && (
          <div className="nd-p-b">
            <Writer placeholder={`What's the thinking on ${r.player.name.split(' ')[0]}?`} autoFocus={!r.notes.length} onSave={b => addPlayer(r.player, r.mine, b)} />
            <Timeline notes={r.notes} onDelete={id => delPlayer(r.player.id, id)} />
            <button type="button" className="nd-link" onClick={() => openPlayer(r.player.id)}><i className="bi bi-person-vcard"></i> Open his card</button>
          </div>
        )}
      </li>
    )
  }

  return (
    <section className="nd-panel" style={team} aria-label="My notes">
      <header className="nd-head">
        {league?.user_team && <TeamBadge name={league.user_team.id} size={34} showName={false} />}
        <div className="nd-head-t">
          <h3>My notes</h3>
          <span><i className="bi bi-lock-fill"></i> Only you can see these</span>
        </div>
        <button type="button" className="nd-min" onClick={() => toggle(false)} aria-label="Minimise notes"><i className="bi bi-chevron-down"></i></button>
      </header>
      <div className="nd-seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'players'} className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>
          Players{playerCount > 0 && <em>{data?.players.length}</em>}</button>
        <button type="button" role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>
          General{(data?.general.length || 0) > 0 && <em>{data?.general.length}</em>}</button>
      </div>
      <div className="nd-body">
        {error && <div className="nd-error" role="alert">{error}</div>}
        {!data ? <p className="nd-empty">Loading your notes</p> : tab === 'general' ? (
          <>
            <Writer placeholder="Plans, targets, reminders for this league" onSave={addGeneral} />
            {data.general.length
              ? <ul className="nd-gens">{data.general.map(n => <GeneralCard key={n.id} n={n} onDelete={() => delGeneral(n.id)} />)}</ul>
              : <div className="nd-blank"><NoteIcon size={26} /><b>Nothing here yet</b><span>Draft plans, trade targets, anything you want to remember this season.</span></div>}
          </>
        ) : (
          <>
            {!picking ? (
              <button type="button" className="nd-new" onClick={() => { setPicking(true); setScope('mine'); setQuery('') }}>
                <i className="bi bi-plus-lg"></i> New player note
              </button>
            ) : (
              <div className="nd-pick">
                <div className="nd-pick-top">
                  <div className="nd-scope" role="tablist">
                    <button type="button" className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>Your squad</button>
                    <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Everyone</button>
                  </div>
                  <button type="button" className="nd-x" onClick={() => setPicking(false)} aria-label="Cancel"><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="nd-search"><i className="bi bi-search"></i>
                  <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder={scope === 'mine' ? 'Find someone on your list' : 'Search any player in the AFL'} aria-label="Find a player" />
                </div>
                <ul>
                  {(scope === 'mine' ? squadPick : found).slice(0, 12).map(c => (
                    <li key={c.id}><button type="button" onClick={() => choose(c)}>
                      <Avatar c={c} logos={logos} size={34} />
                      <span className="nd-pick-n"><b>{c.name}</b><span><Pos p={c.position} />{c.afl_team}{c.is_former ? ', off list' : ''}</span></span>
                      <i className="bi bi-plus-circle"></i>
                    </button></li>
                  ))}
                  {scope === 'all' && query.trim().length >= 2 && !found.length && <li className="nd-none">No player by that name.</li>}
                  {scope === 'all' && query.trim().length < 2 && <li className="nd-none">Type two letters of his name.</li>}
                </ul>
              </div>
            )}
            {!rows.length && !picking && (
              <div className="nd-blank"><NoteIcon size={26} /><b>No player notes yet</b><span>Start one above, or from the My notes button on any player's card.</span></div>
            )}
            {mineRows.length > 0 && (<><h4 className="nd-group">Your squad <em>{mineRows.length}</em></h4><ul className="nd-ps">{mineRows.map(rowView)}</ul></>)}
            {otherRows.length > 0 && (<><h4 className="nd-group">Watching <em>{otherRows.length}</em></h4><ul className="nd-ps">{otherRows.map(rowView)}</ul></>)}
          </>
        )}
      </div>
    </section>
  )
}
