import { useParams } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { useWishlist } from '../../hooks/useWishlist'
import { WishlistStar } from '../../components/ui/WishlistStar'
import { LeagueBreadcrumb } from '../../components/ui/LeagueBreadcrumb'

interface RatingChange {
  player_id: number
  player_name: string
  afl_team: string
  position: string
  old_rating: number
  new_rating: number
  delta: number
  changed_at: string | null
}
interface SeasonMover {
  id: number
  name: string
  afl_team: string
  position: string
  rating: number
  rating_start: number
  delta: number
  career_games: number
  games_played: number
  is_debutant: boolean
}
interface RatingsData {
  league: { id: number; name: string }
  last_update_date: string | null
  last_update: RatingChange[]
  season_movers: SeasonMover[]
}

const RM_CSS = `
.rm-controls { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:12px 16px; border-bottom:1px solid var(--kl-border); }
.rm-seg { display:inline-flex; background:rgba(15,22,36,.6); border:1px solid var(--kl-border); border-radius:999px; padding:3px; }
.rm-seg-btn { padding:5px 14px; border:0; background:transparent; color:var(--kl-text-secondary); font-size:.76rem; font-weight:700; border-radius:999px; cursor:pointer; transition:background .12s,color .12s; }
.rm-seg-btn.active.up { background:rgba(63,185,80,.16); color:#3fb950; }
.rm-seg-btn.active.down { background:rgba(248,81,73,.16); color:#f85149; }
.rm-seg-btn.active.all { background:rgba(88,166,255,.16); color:#58a6ff; }
.rm-pos { display:inline-flex; gap:4px; flex-wrap:wrap; }
.rm-chip { padding:4px 9px; border:1px solid var(--kl-border); background:transparent; color:var(--kl-text-secondary); font-size:.7rem; font-weight:700; border-radius:8px; cursor:pointer; transition:all .12s; }
.rm-chip:hover { border-color:var(--kl-border-light,#444c56); color:var(--kl-text-primary); }
.rm-chip.active { background:rgba(88,166,255,.14); border-color:rgba(88,166,255,.5); color:#58a6ff; }
.rm-toggle { display:inline-flex; align-items:center; gap:7px; margin-left:auto; font-size:.76rem; color:var(--kl-text-secondary); cursor:pointer; user-select:none; }
.rm-toggle input { accent-color:#58a6ff; width:15px; height:15px; }
.rm-debut { display:inline-block; font-size:.56rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; padding:1px 5px; border-radius:4px; margin-left:6px; background:rgba(210,153,34,.16); color:#d29922; vertical-align:middle; }
.rm-arrow { color:var(--kl-text-muted); font-size:.7rem; margin:0 4px; }
.rm-count { font-size:.72rem; color:var(--kl-text-muted); }
.rm-empty { padding:28px 16px; text-align:center; color:var(--kl-text-muted); font-size:.85rem; }
@media (max-width:600px){ .rm-controls{ gap:8px; } .rm-toggle{ margin-left:0; width:100%; } }
`

function deltaBadge(delta: number) {
  if (delta > 0) return <span className="badge" style={{ background: 'rgba(63,185,80,.15)', color: '#3fb950' }}>+{delta}</span>
  if (delta < 0) return <span className="badge" style={{ background: 'rgba(248,81,73,.15)', color: '#f85149' }}>{delta}</span>
  return <span className="text-secondary">—</span>
}

type MoverView = 'risers' | 'fallers' | 'all'
const POSITIONS = ['DEF', 'MID', 'RUC', 'FWD']

export function PlayerRatingsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<RatingsData>(`/leagues/${leagueId}/player-ratings?format=json`)
  const wishlist = useWishlist(leagueId)
  const [view, setView] = useState<MoverView>('risers')
  const [pos, setPos] = useState<string>('ALL')
  // Default ON: debutants' base→X jumps dwarf established players' moves, so
  // the meaningful list (established risers/fallers) shows first.
  const [hideDebut, setHideDebut] = useState(true)

  const movers = useMemo(() => {
    const all = data?.season_movers ?? []
    let m = all
    if (hideDebut) m = m.filter(p => !p.is_debutant)
    if (pos !== 'ALL') m = m.filter(p => (p.position || '').split('/').includes(pos))
    if (view === 'risers') m = m.filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta)
    else if (view === 'fallers') m = m.filter(p => p.delta < 0).sort((a, b) => a.delta - b.delta)
    else m = [...m].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    return m
  }, [data, view, pos, hideDebut])

  if (loading) return <Spinner text="Loading ratings..." />
  if (!data) return <p className="text-danger">Failed to load ratings</p>

  const debutCount = (data.season_movers ?? []).filter(p => p.is_debutant).length

  return (
    <div>
      <style>{RM_CSS}</style>
      <div className="d-none d-lg-block"><PlayersSubnav active="ratings" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <LeagueBreadcrumb leagueId={leagueId!} fallbackName={data.league.name} /> / Players / Ratings
        </div>
        <div>
          <h2 className="mb-0"><i className="bi bi-star me-2" style={{ color: '#d29922' }}></i>Player Ratings</h2>
          {data.last_update_date && (
            <div className="text-secondary" style={{ fontSize: '.85rem' }}>
              Last rating change: {new Date(data.last_update_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* ── Season Movers — the hero: who's moved since start of year ── */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-graph-up-arrow me-2" style={{ color: '#3fb950' }}></i>Season Movers
          </h5>
          <span className="rm-count">{movers.length} shown · since start of year</span>
        </div>

        <div className="rm-controls">
          <div className="rm-seg" role="tablist" aria-label="Mover direction">
            <button className={`rm-seg-btn up${view === 'risers' ? ' active' : ''}`} onClick={() => setView('risers')}><i className="bi bi-caret-up-fill me-1"></i>Risers</button>
            <button className={`rm-seg-btn down${view === 'fallers' ? ' active' : ''}`} onClick={() => setView('fallers')}><i className="bi bi-caret-down-fill me-1"></i>Fallers</button>
            <button className={`rm-seg-btn all${view === 'all' ? ' active' : ''}`} onClick={() => setView('all')}>All</button>
          </div>
          <div className="rm-pos">
            <button className={`rm-chip${pos === 'ALL' ? ' active' : ''}`} onClick={() => setPos('ALL')}>All pos</button>
            {POSITIONS.map(p => (
              <button key={p} className={`rm-chip${pos === p ? ' active' : ''}`} onClick={() => setPos(p)}>{p}</button>
            ))}
          </div>
          <label className="rm-toggle" title="First-year players jump from a low base rating, dwarfing established players' moves">
            <input type="checkbox" checked={hideDebut} onChange={e => setHideDebut(e.target.checked)} />
            Hide first-year players{debutCount > 0 ? ` (${debutCount})` : ''}
          </label>
        </div>

        <div className="card-body p-0" style={{ maxHeight: 620, overflowY: 'auto' }}>
          {movers.length === 0 ? (
            <div className="rm-empty">No {view === 'all' ? 'movers' : view} match these filters.</div>
          ) : (
            <table className="table table-sm mb-0">
              <thead><tr>
                <th style={{ width: 30 }} aria-label="Watchlist"></th>
                <th style={{ width: 36 }} className="text-center">#</th>
                <th>Player</th><th>Pos</th>
                <th className="text-end">Start</th><th className="text-center"></th><th className="text-end">Now</th>
                <th className="text-end">Δ</th>
              </tr></thead>
              <tbody>
                {movers.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-center" style={{ padding: 0, verticalAlign: 'middle' }}>
                      <WishlistStar wishlist={wishlist} playerId={p.id} playerName={p.name} />
                    </td>
                    <td className="text-center text-secondary" style={{ fontSize: '.78rem' }}>{i + 1}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.is_debutant && <span className="rm-debut" title="Debuted this year">1st yr</span>}
                      <div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team}</div>
                    </td>
                    <td>{(p.position || 'MID').split('/').map(ps => <span key={ps} className={`pos-badge pos-${ps}`} style={{ fontSize: '.62rem', padding: '1px 5px' }}>{ps}</span>)}</td>
                    <td className="text-end text-secondary">{p.rating_start}</td>
                    <td className="text-center"><i className="bi bi-arrow-right rm-arrow"></i></td>
                    <td className="text-end"><strong>{p.rating}</strong></td>
                    <td className="text-end">{deltaBadge(p.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Latest Update — genuine changes from the most recent sync ── */}
      <div className="card mt-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-arrow-repeat me-2" style={{ color: '#58a6ff' }}></i>Latest Update
          </h5>
          <span className="rm-count">{data.last_update.length} change{data.last_update.length === 1 ? '' : 's'}</span>
        </div>
        <div className="card-body p-0" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {data.last_update.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="bi bi-stars"></i></div>
              <h4>No recent changes</h4>
              <p>Genuine rating changes from the next ratings refresh will show here.</p>
            </div>
          ) : (
            <table className="table table-sm mb-0">
              <thead><tr><th style={{ width: 30 }} aria-label="Watchlist"></th><th>Player</th><th>Pos</th><th className="text-end">Old</th><th className="text-end">New</th><th className="text-end">Δ</th></tr></thead>
              <tbody>
                {data.last_update.map(r => (
                  <tr key={`${r.player_id}-${r.changed_at}`}>
                    <td className="text-center" style={{ padding: 0, verticalAlign: 'middle' }}>
                      <WishlistStar wishlist={wishlist} playerId={r.player_id} playerName={r.player_name} />
                    </td>
                    <td><strong>{r.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{r.afl_team}</div></td>
                    <td><span className={`pos-badge pos-${r.position}`}>{r.position}</span></td>
                    <td className="text-end text-secondary">{r.old_rating}</td>
                    <td className="text-end"><strong>{r.new_rating}</strong></td>
                    <td className="text-end">{deltaBadge(r.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
