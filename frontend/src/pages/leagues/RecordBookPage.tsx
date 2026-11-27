import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useKeptFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { TeamBadge } from '../../components/ui/TeamBadge'
import { PlayerFace } from '../../components/ui/PlayerFace'
import { useOpenPlayer } from '../../components/squad/PlayerPopup'
import { usePageState } from '../../lib/pageMemory'

// The Record Book (League > Records), 2026-11-27. What is the best (and
// worst) ever done: club, player and match records, every head-to-head, the
// all-time ladder. Honours (what a player has earned) and Seasons (one year)
// are separate pages; nothing here hands out badges. Concept: artifact
// NGSh3hPtSk6HTY6nQJsR2o. Data: models/record_book.py. Styles: .rb-*.

interface Entry {
  value: number; year?: number; round?: number
  team?: string; wins?: number; losses?: number; from_round?: number; to_round?: number; from_year?: number; years?: number[]
  player_id?: number; player?: string; afl_team?: string; position?: string; photo_url?: string | null; games?: number
  winner?: string; loser?: string; winner_score?: number; loser_score?: number; margin?: number; total?: number; draw?: boolean
}
interface Rec { key: string; label: string; unit: string; kind: 'club' | 'player' | 'match'; top: Entry | null; next: Entry[] }
interface Cell { w: number; l: number; d: number; games: { year: number; round: number; for: number; against: number }[] }
interface Data {
  clubs: Rec[]; players: Rec[]; matches: Rec[]
  teams: { id: number; name: string }[]
  h2h: Record<string, Cell>
  ladder: { team: string; seasons: number; wins: number; losses: number; draws: number; win_pct: number; pct: number; points_for: number; flags: number[] }[]
  since: number | null
}

const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1))

function when(r: Rec, e: Entry): string {
  switch (r.key) {
    case 'season_pf': return `${e.year}, ${e.wins} wins`
    case 'win_run': case 'loss_run':
      return e.from_year && e.from_year !== e.year ? `Round ${e.from_round} ${e.from_year} to round ${e.to_round} ${e.year}` : `Rounds ${e.from_round} to ${e.to_round}, ${e.year}`
    case 'flags': return (e.years || []).join(', ')
    case 'p_total': case 'p_avg': return `${e.year}, ${e.games} games`
    case 'p_hundreds': return `${e.year}, from ${e.games} games`
    default: return e.round != null ? `Round ${e.round}, ${e.year}` : String(e.year ?? '')
  }
}

function RecordCard({ r, openPlayer }: { r: Rec; openPlayer: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const e = r.top
  if (!e) return null
  return (
    <article className="rb-card">
      <div className="rb-top">
        <span className="rb-label">{r.label}</span>
        <div className="rb-num">{n(e.value)}{r.unit && <small>{e.value === 1 && r.unit.endsWith('s') ? r.unit.slice(0, -1) : r.unit}</small>}</div>
        {r.kind === 'player' && e.player_id ? (
          <button type="button" className="rb-holder" onClick={() => openPlayer(e.player_id!)}>
            <PlayerFace name={e.player} afl_team={e.afl_team} photo_url={e.photo_url} size={52} />
            <span><b>{e.player}</b><span className="rb-sub"><TeamBadge name={e.team} size={22} /></span><span className="rb-when">{when(r, e)}</span></span>
          </button>
        ) : r.kind === 'club' ? (
          <div className="rb-holder">
            <TeamBadge name={e.team} size={52} showName={false} />
            <span><b>{e.team}</b><span className="rb-when">{when(r, e)}</span></span>
          </div>
        ) : (
          <div className="rb-match">
            <div className="rb-side win"><TeamBadge name={e.winner} size={30} showName={false} /><b>{e.winner}</b><em>{n(e.winner_score!)}</em></div>
            <div className="rb-side"><TeamBadge name={e.loser} size={30} showName={false} /><b>{e.loser}</b><em>{n(e.loser_score!)}</em></div>
            <span className="rb-when">{when(r, e)}</span>
          </div>
        )}
      </div>
      {r.next.length > 0 && (
        <div className="rb-pack">
          <button type="button" className="rb-pack-h" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <span>Next best</span><span>{r.next.length}<i className={`bi bi-chevron-${open ? 'up' : 'down'}`}></i></span>
          </button>
          {open && (
            <ol>
              {r.next.map((x, i) => (
                <li key={i}>
                  <em>{i + 2}</em>
                  <span className="rb-who">
                    {r.kind === 'player'
                      ? <><PlayerFace name={x.player} afl_team={x.afl_team} photo_url={x.photo_url} size={28} /><span>{x.player}, {when(r, x).toLowerCase()}</span></>
                      : r.kind === 'club'
                        ? <><TeamBadge name={x.team} size={28} showName={false} /><span>{x.team}, {when(r, x).toLowerCase()}</span></>
                        : <><TeamBadge name={x.winner} size={28} showName={false} /><span>{x.winner} v {x.loser}, round {x.round}</span></>}
                  </span>
                  <b>{n(x.value)}</b>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}

type View = 'clubs' | 'players' | 'matches' | 'rivalries' | 'ladder'

export function RecordBookPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useKeptFetch<Data>(`/api/leagues/${leagueId}/record-book`)
  const [view, setView] = usePageState<View>('view', 'clubs')
  const [pair, setPair] = usePageState<string | null>('pair', null)
  const openPlayer = useOpenPlayer()

  if (loading && !data) return <Spinner />
  if (error || !data) return <div className="kx-page"><p>The record book could not be loaded.</p></div>
  const views: [View, string][] = [['clubs', 'Clubs'], ['players', 'Players'], ['matches', 'Matches'], ['rivalries', 'Rivalries'], ['ladder', 'All-time ladder']]
  const recs = view === 'clubs' ? data.clubs : view === 'players' ? data.players : view === 'matches' ? data.matches : []
  const cellBg = (c?: Cell) => {
    if (!c || c.w + c.l + c.d === 0) return undefined
    const s = (c.w + c.d / 2) / (c.w + c.l + c.d)
    if (s === 0.5) return '#26262e'
    const k = Math.abs(s - .5) * 2
    return s > .5 ? `rgba(46,160,67,${(.25 + .6 * k).toFixed(2)})` : `rgba(218,54,51,${(.25 + .6 * k).toFixed(2)})`
  }
  const sel = pair ? data.h2h[pair] : null
  const [pa, pb] = pair ? pair.split('-').map(Number) : [0, 0]
  const tname = (id: number) => data.teams.find(t => t.id === id)?.name || ''

  return (
    <div className="kx-page rb">
      <div className="d-none d-lg-block"><LeagueSubnav active="records" leagueId={leagueId!} /></div>
      <div className="page-breadcrumb d-none d-lg-block"><Link to={`/leagues/${leagueId}`}>League</Link> / Records</div>
      <header className="rb-head">
        <div><h2>Record Book</h2><p>Every record{data.since ? ` since ${data.since}` : ''}. League rounds only.</p></div>
        <div className="hb2-views" role="tablist">
          {views.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
        </div>
      </header>

      {recs.length > 0 && (
        <div className={`rb-grid rb-grid-${recs.length}`}>
          {recs.map(r => <RecordCard key={r.key} r={r} openPlayer={openPlayer} />)}
        </div>
      )}

      {view === 'rivalries' && (
        <section className="rb-panel">
          <div className="rb-grid-wrap">
            <table className="rb-h2h">
              <thead><tr><th></th>{data.teams.map(t => <th key={t.id}><TeamBadge name={t.id} size={32} showName={false} /></th>)}</tr></thead>
              <tbody>
                {data.teams.map(a => (
                  <tr key={a.id}>
                    <th className="row"><TeamBadge name={a.id} size={28} /></th>
                    {data.teams.map(b => {
                      if (a.id === b.id) return <td key={b.id} className="self" />
                      const k = `${a.id}-${b.id}`, c = data.h2h[k]
                      return (
                        <td key={b.id}>
                          <button type="button" className={pair === k ? 'on' : ''} style={{ background: cellBg(c) }} onClick={() => setPair(pair === k ? null : k)} disabled={!c}>
                            {c ? <>{c.w}-{c.l}{c.d ? `-${c.d}` : ''}<small>{c.w > c.l ? 'Leads' : c.w < c.l ? 'Trails' : 'Level'}</small></> : '-'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rb-key"><span><i style={{ background: 'rgba(46,160,67,.7)' }} />Has the better of it</span><span><i style={{ background: '#26262e' }} />Level</span><span><i style={{ background: 'rgba(218,54,51,.7)' }} />Has the worse of it</span><span>Read across: the row club against the column club. Tap a square for the games.</span></div>
          {sel && (
            <div className="rb-games">
              <h3><TeamBadge name={pa} size={28} /> <span>v</span> <TeamBadge name={pb} size={28} /></h3>
              <table className="rb-tbl"><thead><tr><th>Season</th><th>Round</th><th className="n">{tname(pa)}</th><th className="n">{tname(pb)}</th><th>Result</th></tr></thead>
                <tbody>{sel.games.map((g, i) => <tr key={i}><td>{g.year}</td><td>{g.round}</td><td className="n">{n(g.for)}</td><td className="n">{n(g.against)}</td><td className={g.for > g.against ? 'w' : g.for < g.against ? 'l' : ''}>{g.for > g.against ? 'Won' : g.for < g.against ? 'Lost' : 'Drew'} by {n(Math.abs(g.for - g.against))}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === 'ladder' && (
        <section className="rb-panel rb-panel-flush">
          <div className="rb-grid-wrap">
            <table className="rb-tbl rb-ladder">
              <thead><tr><th>#</th><th>Club</th><th className="n">Seasons</th><th className="n">Won</th><th className="n">Lost</th><th className="n">Drawn</th><th className="n">Win %</th><th className="n">%</th><th className="n">Points for</th><th className="n">Flags</th></tr></thead>
              <tbody>
                {data.ladder.map((r, i) => (
                  <tr key={r.team}>
                    <td className="rb-pos">{i + 1}</td>
                    <td><TeamBadge name={r.team} size={30} /></td>
                    <td className="n">{r.seasons}</td><td className="n">{r.wins}</td><td className="n">{r.losses}</td><td className="n">{r.draws}</td>
                    <td className="n"><b>{r.win_pct}%</b></td><td className="n">{r.pct.toFixed(1)}</td><td className="n">{n(r.points_for)}</td>
                    <td className="n">{r.flags.length ? <span className="rb-flags" title={r.flags.join(', ')}>{r.flags.map(y => <i key={y} />)}<b>{r.flags.length}</b></span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
