import { useEffect, useMemo, useRef, useState } from 'react'
import { api, post } from '../../lib/api'
import { noteStamp } from '../ui/PlayerNotes'
import { useOpenPlayer } from '../squad/PlayerPopup'

// The notes panel on My Team (Lucas, 2026-11-27): a button bottom right that
// opens and minimises it. General notes for this league, and notes on
// players: your own squad first, then anyone else. A note written on a
// player's card is the same note, so it shows up here too.
// Data: /api/leagues/<id>/notes, /api/players/search. Styles: .nd-* in static/style.css.

interface Note { id: number; body: string; created_at: string }
interface Card { id: number; name: string; position: string; afl_team: string; is_former?: boolean }
interface PlayerNotesRow { player: Card; mine: boolean; latest: string; notes: Note[] }
interface Data { general: Note[]; players: PlayerNotesRow[]; squad: Card[] }

const MAX = 2000
const OPEN_KEY = 'kl-notes-open'

function readOpen() { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } }
function keepOpen(v: boolean) { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0') } catch { /* private mode */ } }

function NoteIcon() {
  return <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 2.5h7l3 3v8H3z M10 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" /></svg>
}

function Writer({ placeholder, onSave, autoFocus }: { placeholder: string; onSave: (body: string) => Promise<void>; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  async function save() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true); setError(null)
    try { await onSave(body); setDraft('') } catch { setError('That note was not saved. Try again.') } finally { setSaving(false) }
  }
  return (
    <div className="nd-write">
      <textarea ref={ref} rows={2} value={draft} placeholder={placeholder} aria-label={placeholder}
        onChange={e => setDraft(e.target.value.slice(0, MAX))}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save() }} />
      <button type="button" className="nd-save" onClick={save} disabled={!draft.trim() || saving}>{saving ? 'Saving' : 'Add note'}</button>
      {error && <div className="nd-error" role="alert">{error}</div>}
    </div>
  )
}

function NoteList({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  const [confirm, setConfirm] = useState<number | null>(null)
  if (!notes.length) return null
  return (
    <ul className="nd-notes">
      {notes.map(n => (
        <li key={n.id}>
          <div className="nd-note-top">
            <time dateTime={n.created_at}>{noteStamp(n.created_at)}</time>
            {confirm === n.id ? (
              <span className="nd-confirm">
                <button type="button" className="nd-del-yes" onClick={() => { setConfirm(null); onDelete(n.id) }}>Delete</button>
                <button type="button" className="nd-del-no" onClick={() => setConfirm(null)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="nd-del" onClick={() => setConfirm(n.id)} aria-label="Delete this note"><i className="bi bi-trash3"></i></button>
            )}
          </div>
          <p>{n.body}</p>
        </li>
      ))}
    </ul>
  )
}

export function NotesDock({ leagueId }: { leagueId: string }) {
  const [open, setOpen] = useState(readOpen)
  const [tab, setTab] = useState<'general' | 'players'>('players')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [adding, setAdding] = useState<'mine' | 'other' | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Card[]>([])
  const [picked, setPicked] = useState<Card[]>([])  // players chosen to write on who have no notes yet
  const openPlayer = useOpenPlayer()

  function load() {
    api<Data>(`/api/leagues/${leagueId}/notes`).then(d => { setData(d); setError(null) })
      .catch(() => setError('Your notes could not be loaded.'))
  }
  useEffect(() => { if (open) load() }, [open, leagueId]) // eslint-disable-line react-hooks/exhaustive-deps

  // search everyone, as you type
  useEffect(() => {
    if (adding !== 'other' || query.trim().length < 2) { setFound([]); return }
    let live = true
    const t = setTimeout(() => {
      api<{ players: Card[] }>(`/api/players/search?q=${encodeURIComponent(query.trim())}`)
        .then(d => { if (live) setFound(d.players) }).catch(() => { if (live) setFound([]) })
    }, 180)
    return () => { live = false; clearTimeout(t) }
  }, [query, adding])

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
    setExpanded(c.id); setAdding(null); setQuery(''); setFound([])
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
      const rest = x.players.filter(r => r.player.id !== c.id)
      const cur = x.players.find(r => r.player.id === c.id)
      const row = { player: c, mine, latest: d.note.created_at, notes: [d.note, ...(cur?.notes || [])] }
      return { ...x, players: mine ? [row, ...rest] : [...rest.filter(r => r.mine), row, ...rest.filter(r => !r.mine)] }
    })
    setPicked(p => p.filter(x => x.id !== c.id))
  }
  async function delPlayer(pid: number, id: number) {
    const before = data
    setData(x => x ? { ...x, players: x.players.map(r => r.player.id === pid ? { ...r, notes: r.notes.filter(n => n.id !== id) } : r).filter(r => r.notes.length) } : x)
    try { await api(`/api/players/notes/${id}`, { method: 'DELETE' }) } catch { setData(before); setError('That note was not deleted. Try again.') }
  }

  const total = (data?.general.length || 0) + (data?.players.reduce((a, r) => a + r.notes.length, 0) || 0)

  if (!open) {
    return (
      <button type="button" className="nd-fab" onClick={() => toggle(true)} aria-label="Open my notes">
        <NoteIcon />
        <span>Notes</span>
      </button>
    )
  }

  const mineRows = rows.filter(r => r.mine)
  const otherRows = rows.filter(r => !r.mine)
  const rowView = (r: PlayerNotesRow) => {
    const on = expanded === r.player.id
    return (
      <li key={r.player.id} className={'nd-player' + (on ? ' on' : '')}>
        <button type="button" className="nd-player-h" onClick={() => setExpanded(on ? null : r.player.id)} aria-expanded={on}>
          <span className={`pos-badge badge-${(r.player.position || 'MID').split('/')[0].toLowerCase()}`}>{(r.player.position || 'MID').split('/')[0]}</span>
          <b>{r.player.name}</b>
          <span className="nd-club">{r.player.afl_team}</span>
          <span className="nd-count">{r.notes.length || 'New'}</span>
          <i className={`bi bi-chevron-${on ? 'up' : 'down'}`}></i>
        </button>
        {on && (
          <div className="nd-player-b">
            <Writer placeholder={`Note on ${r.player.name}`} autoFocus={!r.notes.length} onSave={b => addPlayer(r.player, r.mine, b)} />
            <NoteList notes={r.notes} onDelete={id => delPlayer(r.player.id, id)} />
            <button type="button" className="nd-link" onClick={() => openPlayer(r.player.id)}>Open his card</button>
          </div>
        )}
      </li>
    )
  }

  return (
    <section className="nd-panel" aria-label="My notes">
      <header className="nd-head">
        <h3>My notes{total ? <span className="nd-total">{total}</span> : null}</h3>
        <span className="nd-private"><i className="bi bi-lock-fill"></i> Only you see these</span>
        <button type="button" className="nd-min" onClick={() => toggle(false)} aria-label="Minimise notes"><i className="bi bi-dash-lg"></i></button>
      </header>
      <div className="nd-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'players'} className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Players</button>
        <button type="button" role="tab" aria-selected={tab === 'general'} className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>General</button>
      </div>
      <div className="nd-body">
        {error && <div className="nd-error" role="alert">{error}</div>}
        {!data ? <p className="nd-empty">Loading your notes</p> : tab === 'general' ? (
          <>
            <Writer placeholder="A note for this league: plans, targets, reminders" onSave={addGeneral} />
            {data.general.length ? <NoteList notes={data.general} onDelete={delGeneral} /> : <p className="nd-empty">No general notes yet.</p>}
          </>
        ) : (
          <>
            <div className="nd-adds">
              <button type="button" className={adding === 'mine' ? 'on' : ''} onClick={() => { setAdding(adding === 'mine' ? null : 'mine'); setQuery('') }}>
                <i className="bi bi-plus-lg"></i> Your player</button>
              <button type="button" className={adding === 'other' ? 'on' : ''} onClick={() => { setAdding(adding === 'other' ? null : 'other'); setQuery('') }}>
                <i className="bi bi-search"></i> Other player</button>
            </div>
            {adding && (
              <div className="nd-pick">
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={adding === 'mine' ? 'Filter your squad' : 'Search any player'} aria-label="Find a player" />
                <ul>
                  {(adding === 'mine' ? squadPick : found).slice(0, 12).map(c => (
                    <li key={c.id}><button type="button" onClick={() => choose(c)}>
                      <span className={`pos-badge badge-${(c.position || 'MID').split('/')[0].toLowerCase()}`}>{(c.position || 'MID').split('/')[0]}</span>
                      <b>{c.name}</b><span className="nd-club">{c.afl_team}{c.is_former ? ', off list' : ''}</span>
                    </button></li>
                  ))}
                  {adding === 'other' && query.trim().length >= 2 && !found.length && <li className="nd-none">No player by that name.</li>}
                  {adding === 'other' && query.trim().length < 2 && <li className="nd-none">Type two letters of his name.</li>}
                </ul>
              </div>
            )}
            {!rows.length && !adding && <p className="nd-empty">No player notes yet. Add one above, or from any player's card.</p>}
            {mineRows.length > 0 && (<><h4 className="nd-group">Your squad</h4><ul className="nd-players">{mineRows.map(rowView)}</ul></>)}
            {otherRows.length > 0 && (<><h4 className="nd-group">Other players</h4><ul className="nd-players">{otherRows.map(rowView)}</ul></>)}
          </>
        )}
      </div>
    </section>
  )
}
