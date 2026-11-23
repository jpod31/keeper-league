import { useParams, Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { api, post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useStatsYear } from '../../contexts/LeagueContext'
import { clubVars, ratingTier, rgbOf } from '../../lib/clubs'
import { TeamCrest } from '../../components/draft/TeamCrest'

interface BlockPlayer {
  id: number
  name: string
  position: string
  position_expected: boolean
  afl_team: string
  age: number | null
  rating: number | null
  potential: number | null
  sc_avg: number | null
  games_played: number
  is_former: boolean
  l5?: number | null
  on_block?: boolean
}

interface Entry {
  id: number
  team: { id: number; name: string; logo: string | null; coach: string; accent?: string } | null
  player: BlockPlayer
  seeking: string[]
  note: string
  created_at: string | null
  is_mine: boolean
}

interface BlockData {
  league: { id: number; name: string }
  entries: Entry[]
  my_team: { id: number; name: string } | null
  my_roster: BlockPlayer[]
  seeking_options: { key: string; label: string }[]
  team_logos: Record<string, string>
  trade_window_open: boolean
  teams: { id: number; name: string }[]
}

const NOTE_MAX = 240

/** "today", "3 days ago", "2 weeks ago": how long he has been up. */
function since(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Listed today'
  if (days === 1) return 'Listed yesterday'
  if (days < 14) return `Listed ${days} days ago`
  if (days < 60) return `Listed ${Math.floor(days / 7)} weeks ago`
  return `Listed ${Math.floor(days / 30)} months ago`
}

function Crest({ team }: { team: { id?: number; name: string; logo: string | null; accent?: string } }) {
  return <TeamCrest team={{ id: team.id ?? 0, name: team.name, logo: team.logo, accent: team.accent ?? '#ececf6' }} size={28} />
}

function PositionChips({ p }: { p: BlockPlayer }) {
  return (
    <>
      {(p.position || 'MID').split('/').filter(Boolean).map(x => (
        <span key={x} className={`pos-badge badge-${x.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`}
          style={{ padding: '2px 7px', fontSize: '.8125rem' }}>
          {x}
        </span>
      ))}
    </>
  )
}

/** Put a player up, or change what you want for one already up. */
function BlockForm({
  data, editing, onClose, onSaved,
}: {
  data: BlockData
  editing: Entry | null
  onClose: () => void
  onSaved: (d: BlockData) => void
}) {
  const [playerId, setPlayerId] = useState<number | null>(editing?.player.id ?? null)
  const [seeking, setSeeking] = useState<string[]>(editing?.seeking.length ? editing.seeking : ['any'])
  const [note, setNote] = useState(editing?.note ?? '')
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const roster = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return data.my_roster.filter(p => (!p.on_block || p.id === editing?.player.id) && (!needle || p.name.toLowerCase().includes(needle)))
  }, [data.my_roster, filter, editing])

  function toggle(key: string) {
    setSeeking(cur => {
      // "Open to offers" stands alone: picking it clears the rest, and
      // picking anything specific clears it.
      if (key === 'any') return ['any']
      const next = cur.filter(k => k !== 'any')
      const has = next.includes(key)
      const out = has ? next.filter(k => k !== key) : [...next, key]
      return out.length ? out : ['any']
    })
  }

  async function save() {
    if (!playerId || saving) return
    setSaving(true); setError(null)
    try {
      const d = await post<BlockData>(`/api/leagues/${data.league.id}/trade-block`, { player_id: playerId, seeking, note: note.trim() })
      onSaved(d)
    } catch (e) {
      let msg = 'That did not save. Try again.'
      try { msg = JSON.parse((e as Error).message).error || msg } catch { /* not json */ }
      setError(msg)
      setSaving(false)
    }
  }

  return (
    <div className="tb-modal-back" onClick={onClose}>
      <div className="tb-modal" role="dialog" aria-modal="true" aria-label="Put a player up for trade" onClick={e => e.stopPropagation()}>
        <div className="tb-modal-head">
          <h3>{editing ? `${editing.player.name} on the block` : 'Put a player up for trade'}</h3>
          <button type="button" className="tb-x" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="tb-modal-body">
          {!editing && (
            <div>
              <div className="tb-field-label">Player</div>
              <label className="kx-search" style={{ maxWidth: 'none', marginBottom: 8 }}>
                <i className="bi bi-search"></i>
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search your list" aria-label="Search your list" />
              </label>
              <div className="tb-pick">
                {roster.length === 0 && <div className="kx-empty" style={{ padding: 20 }}>Everyone on your list is already up.</div>}
                {roster.map(p => (
                  <button key={p.id} type="button" className={`tb-pick-row${playerId === p.id ? ' on' : ''}`} onClick={() => setPlayerId(p.id)}>
                    {data.team_logos[p.afl_team] ? <img src={data.team_logos[p.afl_team]} alt="" /> : <span />}
                    <span className="nm">{p.name}</span>
                    <span style={{ display: 'flex', gap: 4 }}><PositionChips p={p} /></span>
                    <span className="av">{p.sc_avg ? Math.round(p.sc_avg) : '-'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="tb-field-label">Looking for</div>
            <div className="tb-want">
              {data.seeking_options.map(o => (
                <button key={o.key} type="button" className={`kx-chip${seeking.includes(o.key) ? ' on' : ''}`} onClick={() => toggle(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="tb-field-label">Note to the league</div>
            <textarea className="tb-textarea" value={note} onChange={e => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Why he is up, and what would get it done" aria-label="Note to the league" />
            <div className="tb-left">{NOTE_MAX - note.length} left</div>
          </div>
          {error && <div className="tb-err" role="alert">{error}</div>}
        </div>
        <div className="tb-modal-foot">
          <button type="button" className="kx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="kx-btn kx-btn-gold" onClick={save} disabled={!playerId || saving}>
            {saving ? 'Saving' : editing ? 'Save changes' : 'Put him up'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TradeBlockPage() {
  const { leagueId } = useParams()
  const stats = useStatsYear()
  const [data, setData] = useState<BlockData | null>(null)
  const [error, setError] = useState(false)
  const [pos, setPos] = useState('')
  const [teamId, setTeamId] = useState<number | null>(null)
  const [form, setForm] = useState<{ editing: Entry | null } | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    api<BlockData>(`/api/leagues/${leagueId}/trade-block`)
      .then(d => { if (live) setData(d) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [leagueId])

  const shown = useMemo(() => {
    if (!data) return []
    return data.entries.filter(e =>
      (!pos || (e.player.position || '').split('/').includes(pos)) &&
      (teamId == null || e.team?.id === teamId))
  }, [data, pos, teamId])

  if (error) return <div className="kx-empty"><b>The trade block could not be loaded</b>Refresh to try again.</div>
  if (!data) return <Spinner />

  const label = Object.fromEntries(data.seeking_options.map(o => [o.key, o.label]))
  const perTeam = new Map<number, { team: NonNullable<Entry['team']>; n: number }>()
  for (const e of data.entries) {
    if (!e.team) continue
    const cur = perTeam.get(e.team.id)
    if (cur) cur.n += 1
    else perTeam.set(e.team.id, { team: e.team, n: 1 })
  }
  const avgLabel = stats.label ? `${stats.label} avg` : 'Avg'
  const l5Label = stats.tag ? `L5 ${stats.tag}` : 'Last 5'

  async function takeDown(e: Entry) {
    setRemoving(e.id)
    try {
      const d = await api<BlockData>(`/api/leagues/${leagueId}/trade-block/${e.id}`, { method: 'DELETE' })
      setData(d)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="kx-page">
      <div className="page-breadcrumb d-none d-lg-block">
        <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / My Team / Trade block
      </div>
      <div className="kx-head">
        <h2>Trade block</h2>
        <div className="kx-head-side">
          <span className={`kx-chip${data.trade_window_open ? ' kx-chip-gold' : ''}`}>
            <i className={`bi ${data.trade_window_open ? 'bi-unlock-fill' : 'bi-lock-fill'}`}></i>
            Trade window {data.trade_window_open ? 'open' : 'closed'}
          </span>
          <Link to={`/leagues/${leagueId}/trades`} className="kx-btn">Trade centre</Link>
          {data.my_team && (
            <button type="button" className="kx-btn kx-btn-gold" onClick={() => setForm({ editing: null })}>
              <i className="bi bi-megaphone-fill"></i> Put a player up
            </button>
          )}
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className="kx-panel">
          <div className="kx-empty">
            <b>Nobody is up for trade</b>
            Put a player up and every other club gets told.
          </div>
        </div>
      ) : (
        <>
          <div className="tb-strip">
            <button type="button" className={`tb-team${teamId == null ? ' on' : ''}`} onClick={() => setTeamId(null)} style={{ paddingLeft: 12 }}>
              All clubs <span className="tb-team-n">{data.entries.length}</span>
            </button>
            {[...perTeam.values()].sort((a, b) => b.n - a.n).map(({ team, n }) => (
              <button key={team.id} type="button" className={`tb-team${teamId === team.id ? ' on' : ''}`} onClick={() => setTeamId(teamId === team.id ? null : team.id)}>
                <Crest team={team} /> {team.name} <span className="tb-team-n">{n}</span>
              </button>
            ))}
            <div className="kx-seg" role="group" aria-label="Position" style={{ marginLeft: 'auto' }}>
              <button type="button" className={pos === '' ? 'on' : ''} onClick={() => setPos('')}>All</button>
              {['DEF', 'MID', 'RUC', 'FWD'].map(p => (
                <button key={p} type="button" className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="kx-panel"><div className="kx-empty"><b>Nobody matches</b>Clear a filter to see the whole block.</div></div>
          ) : (
            <div className="tb-grid">
              {shown.map(e => {
                const p = e.player
                return (
                  <article key={e.id} className={`tb-card${e.is_mine ? ' mine' : ''}`} style={clubVars(p.afl_team)}>
                    <div className="tb-card-top" style={{ ['--tm' as string]: rgbOf(e.team?.accent) } as React.CSSProperties}>
                      {e.team && <Crest team={e.team} />}
                      <span className="tb-owner">{e.team?.name}{e.is_mine ? ' (you)' : ''}</span>
                      <span className="tb-when">{since(e.created_at)}</span>
                    </div>
                    <div className="tb-body">
                      <div className="tb-who">
                        {data.team_logos[p.afl_team] && <img src={data.team_logos[p.afl_team]} alt="" />}
                        <div style={{ minWidth: 0 }}>
                          <a className="tb-name" href={`/player/${encodeURIComponent(p.name)}`} style={{ textDecoration: 'none' }}>{p.name}</a>
                          <div className="tb-sub">
                            <PositionChips p={p} />
                            <span>{p.afl_team}</span>
                            {p.age != null && <span>Age {p.age}</span>}
                            {p.is_former && <span className="pl-mark pl-mark-off" style={{ marginLeft: 0 }}>OFF AFL LIST</span>}
                          </div>
                        </div>
                      </div>
                      <div className="tb-nums">
                        <div className="tb-num"><b className="gold">{p.sc_avg ? Math.round(p.sc_avg) : '-'}</b><span>{avgLabel}</span></div>
                        <div className="tb-num"><b>{p.l5 ? Math.round(p.l5) : '-'}</b><span>{l5Label}</span></div>
                        <div className="tb-num"><b className={`rt-txt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</b><span>Rating</span></div>
                        <div className="tb-num"><b className={`rt-txt ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</b><span>Potential</span></div>
                      </div>
                      <div>
                        <div className="tb-want-label">Looking for</div>
                        <div className="tb-want">
                          {(e.seeking.length ? e.seeking : ['any']).map(k => (
                            <span key={k} className="kx-chip kx-chip-gold">{label[k] || k}</span>
                          ))}
                        </div>
                      </div>
                      {e.note && <p className="tb-note">{e.note}</p>}
                      <div className="tb-actions">
                        {e.is_mine ? (
                          <>
                            <button type="button" className="kx-btn" onClick={() => setForm({ editing: e })}>Edit</button>
                            <button type="button" className="kx-btn kx-btn-danger" onClick={() => takeDown(e)} disabled={removing === e.id}>
                              {removing === e.id ? 'Removing' : 'Take down'}
                            </button>
                          </>
                        ) : data.my_team && e.team ? (
                          <Link className="kx-btn kx-btn-gold" to={`/leagues/${leagueId}/trades/propose?with=${p.id}&from=${e.team.id}`}>
                            <i className="bi bi-arrow-left-right"></i> Make an offer
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {form && (
        <BlockForm
          data={data}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSaved={d => { setData(d); setForm(null) }}
        />
      )}
    </div>
  )
}
