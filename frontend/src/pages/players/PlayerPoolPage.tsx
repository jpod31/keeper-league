import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'

interface Acquired {
  coach: string | null
  method: string | null
  pick_number: number | null
  draft_year: number | null
  draft_type: string | null
}

interface PoolPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  games_played: number
  career_games: number
  rating: number | null
  rating_start: number | null
  potential: number | null
  injury_severity: string | null
  l3: number | null
  l5: number | null
  owner_team: string | null
  profile_tag: string | null
  profile_css: string | null
  profile_tier: number
  is_selected: boolean
  is_bye: boolean
  acquired: Acquired | null
}

interface TeamColour { fg: string; bg: string }

interface PoolData {
  league: { id: number; name: string; squad_size: number }
  players: PoolPlayer[]
  team_colours: Record<string, TeamColour>
  team_logos: Record<string, string>
  user_team_id: number | null
  roster_count: number
  effective_roster_count: number
  ltil_count: number
  can_pickup: boolean
  ssp_cutoff_round: number
}

// CSS from templates/leagues/player_pool.html <style> block (trimmed to essentials)
const POOL_CSS = `
.pool-table th { padding: .5rem .6rem; font-size: .7rem; border-bottom: 2px solid #30363d; position: relative; cursor: pointer; user-select: none; }
.pool-table th .sort-icon { font-size: .6rem; margin-left: 2px; opacity: .4; }
.pool-table th.sort-active .sort-icon { opacity: 1; color: #58a6ff; }
.pool-table td { padding: .45rem .6rem; vertical-align: middle; font-size: .8rem; }
.pool-table tbody tr { transition: background .1s; }
.pool-table tbody tr:hover { background: rgba(88,166,255,.04) !important; }
.profile-tag { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: .6rem; font-weight: 700; white-space: nowrap; letter-spacing: .3px; }
.tag-elite { background: linear-gradient(135deg, rgba(255,215,0,.3), rgba(255,170,0,.25)); color: #ffd700; border: 1px solid rgba(255,215,0,.4); }
.tag-elite-vet { background: linear-gradient(135deg, rgba(192,132,252,.25), rgba(139,92,246,.2)); color: #c084fc; border: 1px solid rgba(192,132,252,.35); }
.tag-premium { background: linear-gradient(135deg, rgba(251,146,60,.2), rgba(245,158,11,.15)); color: #fb923c; }
.tag-rising { background: rgba(16,185,129,.18); color: #10b981; }
.tag-breakout { background: rgba(6,182,212,.18); color: #06b6d4; }
.tag-proven { background: rgba(59,130,246,.15); color: #3b82f6; }
.tag-steady { background: rgba(148,163,184,.12); color: #94a3b8; }
.tag-developing { background: rgba(74,222,128,.1); color: #4ade80; }
.tag-project { background: rgba(234,179,8,.12); color: #eab308; }
.tag-declining { background: rgba(239,68,68,.15); color: #ef4444; }
.tag-veteran { background: rgba(120,113,108,.12); color: #a8a29e; }
.tag-fringe { background: rgba(82,82,91,.1); color: #71717a; }
.filter-bar { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.filter-bar .form-control-sm, .filter-bar .form-select-sm { background: #0d1117; border-color: #30363d; font-size: .78rem; }
.pool-count { font-size: .75rem; color: #8b949e; white-space: nowrap; display: flex; align-items: center; gap: .35rem; }
.pool-count strong { color: #c9d1d9; }
.pm-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #1c2128; cursor: pointer; background: #0d1117; }
.pm-card:active { background: #161b22; }
.pm-taken { opacity: .5; }
.pm-logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; border-radius: 4px; }
.pm-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pm-row1 { display: flex; align-items: center; gap: 5px; }
.pm-name { font-weight: 700; font-size: .84rem; color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pm-pos-badge { padding: 1px 5px; font-size: .55rem; }
.pm-row2 { display: flex; align-items: center; gap: 5px; font-size: .67rem; color: #6e7681; }
.pm-row2 b { color: #c9d1d9; font-weight: 700; }
.pm-sep { width: 1px; height: 9px; background: #21262d; flex-shrink: 0; }
.pm-right { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.pm-sc { font-size: 1.05rem; font-weight: 800; color: #e6edf3; line-height: 1; }
.pm-sc-none { color: #484f58; font-size: .85rem; }
.pm-owner { font-size: .58rem; font-weight: 700; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.pm-fa { font-size: .58rem; font-weight: 600; color: #3fb950; }
.pm-add { background: rgba(63,185,80,.12); border: none; color: #3fb950; border-radius: 4px; font-size: .58rem; font-weight: 700; cursor: pointer; padding: 2px 8px; }
.pm-l3 { color: #c9d1d9; }
.pm-l3 b { font-weight: 700; }
.pm-l3-delta { font-size: .58rem; font-weight: 700; margin-left: 2px; }
.pm-l3-delta-up { color: #3fb950; }
.pm-l3-delta-down { color: #f85149; }
.pm-l3-delta-flat { color: #484f58; }
`

type SortKey = 'name' | 'pos' | 'age' | 'sc_avg' | 'trend' | 'rating' | 'rtg_move' | 'potential' | 'tag'

function sortValue(p: PoolPlayer, key: SortKey): number | string {
  switch (key) {
    case 'name': return p.name.toLowerCase()
    case 'pos': return p.position
    case 'age': return p.age || 0
    case 'sc_avg': return p.sc_avg || 0
    case 'trend': return (p.l3 || 0) - (p.sc_avg || 0)
    case 'rating': return p.rating || 0
    case 'rtg_move': return (p.rating || 0) - (p.rating_start || p.rating || 0)
    case 'potential': return p.potential || 0
    case 'tag': return p.profile_tier || 13
  }
}

type MobileSortKey = 'sc' | 'name_asc' | 'age' | 'rtg' | 'gp'

export function PlayerPoolPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<PoolData>(`/leagues/${leagueId}/player-pool?format=json`)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('sc_avg')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [mobSort, setMobSort] = useState<MobileSortKey>('sc')
  const [pickingUp, setPickingUp] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!data) return []
    const needle = search.toLowerCase().trim()
    return data.players.filter(p => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false
      if (posFilter) {
        const parts = (p.position || 'MID').split('/')
        if (!parts.includes(posFilter)) return false
      }
      if (teamFilter && p.afl_team !== teamFilter) return false
      if (ageFilter) {
        const age = p.age || 0
        if (ageFilter === '21' && age > 21) return false
        if (ageFilter === '23' && age > 23) return false
        if (ageFilter === '25' && age > 25) return false
        if (ageFilter === '25-30' && (age < 25 || age > 30)) return false
        if (ageFilter === '30+' && age < 30) return false
      }
      if (statusFilter === 'available' && p.owner_team) return false
      if (statusFilter === 'taken' && !p.owner_team) return false
      if (ownerFilter && p.owner_team !== ownerFilter) return false
      return true
    })
  }, [data, search, posFilter, teamFilter, ageFilter, statusFilter, ownerFilter])

  const sorted = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -sortDir
      if (av > bv) return sortDir
      return 0
    })
    return out
  }, [filtered, sortKey, sortDir])

  const mobileSorted = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      switch (mobSort) {
        case 'sc': return (b.sc_avg || 0) - (a.sc_avg || 0)
        case 'name_asc': return a.name.localeCompare(b.name)
        case 'age': return (a.age || 99) - (b.age || 99)
        case 'rtg': return (b.rating || 0) - (a.rating || 0)
        case 'gp': return (b.games_played || 0) - (a.games_played || 0)
        default: return 0
      }
    })
    return out
  }, [filtered, mobSort])

  const teamOptions = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    data.players.forEach(p => { if (p.afl_team) s.add(p.afl_team) })
    return [...s].sort()
  }, [data])

  const ownerOptions = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    data.players.forEach(p => { if (p.owner_team) s.add(p.owner_team) })
    return [...s].sort()
  }, [data])

  const activeFilterCount = [posFilter, teamFilter, ageFilter, statusFilter, ownerFilter].filter(Boolean).length

  async function pickup(playerId: number) {
    if (!confirm('Pick this player up?')) return
    setPickingUp(playerId)
    try {
      const res = await fetch(`/leagues/${leagueId}/player-pool/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
        credentials: 'include',
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(d.error || 'Failed to pick up player')
      } else {
        refetch()
      }
    } finally {
      setPickingUp(null)
    }
  }

  if (loading) return <Spinner text="Loading player pool..." />
  if (!data) return <p className="text-danger">Failed to load player pool</p>

  const { league, team_colours, can_pickup, effective_roster_count, ltil_count, ssp_cutoff_round } = data

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(-1) }
  }

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return 'bi-chevron-expand'
    return sortDir === -1 ? 'bi-chevron-down' : 'bi-chevron-up'
  }

  return (
    <div>
      <style>{POOL_CSS}</style>
      <div className="d-none d-lg-block">
        <PlayersSubnav active="pool" leagueId={leagueId!} />
      </div>

      <div className="page-header d-none d-lg-block">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / Players / Pool
        </div>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Player Pool</h2>
            <span style={{ fontSize: '.78rem', color: '#8b949e' }}>Ranked by draft value</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="pool-count">
              <strong>{sorted.length}</strong> players
            </div>
          </div>
        </div>
      </div>

      {can_pickup && (
        <div
          className="d-flex align-items-center gap-2 mb-3 px-3 py-2 d-none d-lg-flex"
          style={{ background: 'rgba(63,185,80,.08)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 8, fontSize: '.82rem' }}
        >
          <i className="bi bi-person-plus-fill" style={{ color: '#3fb950' }}></i>
          <span style={{ color: '#c9d1d9' }}>
            SSP pickups open — <strong>{effective_roster_count}/{league.squad_size}</strong> roster spots filled
            {ltil_count ? ` (${ltil_count} on LTIL)` : ''}. Closes at Round {ssp_cutoff_round}.
          </span>
        </div>
      )}

      <div className="card d-none d-lg-block">
        <div className="card-header py-2">
          <div className="filter-bar">
            <div style={{ flex: '1 1 200px', maxWidth: 280 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-select form-select-sm" value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Pos</option>
              <option value="DEF">DEF</option>
              <option value="MID">MID</option>
              <option value="FWD">FWD</option>
              <option value="RUC">RUC</option>
            </select>
            <select className="form-select form-select-sm" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Teams</option>
              {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-select form-select-sm" value={ageFilter} onChange={e => setAgeFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Ages</option>
              <option value="21">U21</option>
              <option value="23">U23</option>
              <option value="25">U25</option>
              <option value="25-30">25-30</option>
              <option value="30+">30+</option>
            </select>
            <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="taken">Rostered</option>
            </select>
            <select className="form-select form-select-sm" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Coaches</option>
              {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Desktop table */}
        <div className="card-body p-0 d-none d-lg-block" style={{ maxHeight: '78vh', overflow: 'auto' }}>
          <table className="table table-sm mb-0 pool-table">
            <thead className="sticky-top" style={{ background: '#161b22', zIndex: 2 }}>
              <tr>
                <th style={{ width: 18 }}></th>
                <th className={sortKey === 'name' ? 'sort-active' : ''} onClick={() => toggleSort('name')}>
                  Player <i className={`bi ${sortIcon('name')} sort-icon`}></i>
                </th>
                <th className={sortKey === 'pos' ? 'sort-active' : ''} style={{ width: 80 }} onClick={() => toggleSort('pos')}>
                  Pos <i className={`bi ${sortIcon('pos')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'age' ? 'sort-active ' : ''}text-center`} style={{ width: 45 }} onClick={() => toggleSort('age')}>
                  Age <i className={`bi ${sortIcon('age')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'sc_avg' ? 'sort-active ' : ''}text-end`} style={{ width: 65 }} onClick={() => toggleSort('sc_avg')}>
                  SC <i className={`bi ${sortIcon('sc_avg')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'trend' ? 'sort-active ' : ''}text-center`} style={{ width: 75 }} onClick={() => toggleSort('trend')}>
                  L3 <i className={`bi ${sortIcon('trend')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'rating' ? 'sort-active ' : ''}text-end`} style={{ width: 50 }} onClick={() => toggleSort('rating')}>
                  Rtg <i className={`bi ${sortIcon('rating')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'rtg_move' ? 'sort-active ' : ''}text-center`} style={{ width: 50 }} onClick={() => toggleSort('rtg_move')}>
                  +/- <i className={`bi ${sortIcon('rtg_move')} sort-icon`}></i>
                </th>
                <th className={`${sortKey === 'potential' ? 'sort-active ' : ''}text-end`} style={{ width: 50 }} onClick={() => toggleSort('potential')}>
                  Pot <i className={`bi ${sortIcon('potential')} sort-icon`}></i>
                </th>
                <th className={sortKey === 'tag' ? 'sort-active' : ''} style={{ width: 120 }} onClick={() => toggleSort('tag')}>
                  Profile <i className={`bi ${sortIcon('tag')} sort-icon`}></i>
                </th>
                <th style={{ width: 130 }}>Acquired</th>
                <th className="text-center" style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const positions = (p.position || 'MID').split('/')
                const tc = p.owner_team ? team_colours[p.owner_team] : null
                const l3Base = p.sc_avg || p.l3 || 0
                const l3Diff = (p.l3 || 0) - l3Base
                const l3Pct = l3Base ? (l3Diff / l3Base) * 100 : 0
                const rtgMove = p.rating && p.rating_start ? p.rating - p.rating_start : 0
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '0 0 0 .4rem', verticalAlign: 'middle' }}>
                      {p.is_bye ? <span className="status-dot status-dot-bye"></span>
                        : p.is_selected ? <span className="status-dot status-dot-taken"></span>
                        : p.injury_severity ? <span className="status-dot status-dot-injured"></span>
                        : <span className="status-dot status-dot-available"></span>}
                    </td>
                    <td>
                      <span className="player-link" style={{cursor:"default"}}>
                        {p.afl_team && data.team_logos[p.afl_team] && (
                          <img
                            src={data.team_logos[p.afl_team]}
                            alt=""
                            className="team-icon"
                            style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }}
                          />
                        )}
                        <span className="p-name">{p.name}</span>
                        <span style={{ color: '#c9d1d9', fontSize: '.72rem', marginLeft: 'auto' }}>{p.afl_team}</span>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
                        {['FWD', 'DEF', 'RUC', 'MID'].filter(pos => positions.includes(pos)).map(pos => (
                          <span key={pos} className={`pos-badge badge-${pos.toLowerCase()}`} style={{ padding: '2px 5px', fontSize: '.65rem' }}>{pos}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{p.age || '-'}</td>
                    <td className="text-end">
                      {p.sc_avg ? <span style={{ fontWeight: 600 }}>{p.sc_avg.toFixed(1)}</span> : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td className="text-center">
                      {p.l3 ? (
                        <>
                          <span style={{ fontWeight: 600, color: '#c9d1d9' }}>{Math.round(p.l3)}</span>
                          {l3Pct > 2 ? <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#3fb950', marginLeft: 2 }}>+{Math.round(l3Pct)}%</span>
                            : l3Pct < -2 ? <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#f85149', marginLeft: 2 }}>{Math.round(l3Pct)}%</span>
                            : <span style={{ fontSize: '.65rem', color: '#484f58', marginLeft: 2 }}>-</span>}
                        </>
                      ) : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td className="text-end">
                      {p.rating ? <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{p.rating}</span> : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td className="text-center">
                      {p.rating && p.rating_start ? (
                        rtgMove > 0 ? <span style={{ color: '#3fb950', fontWeight: 600, fontSize: '.78rem' }}>+{rtgMove}</span>
                          : rtgMove < 0 ? <span style={{ color: '#f85149', fontWeight: 600, fontSize: '.78rem' }}>{rtgMove}</span>
                          : <span style={{ color: '#484f58', fontSize: '.78rem' }}>-</span>
                      ) : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td className="text-end">
                      {p.potential ? <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{p.potential}</span> : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td>
                      {p.profile_tag && p.profile_css && (
                        <span className={`profile-tag tag-${p.profile_css}`}>{p.profile_tag}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '.7rem', color: '#8b949e' }}>
                      {p.acquired ? (
                        <>
                          {p.acquired.coach && <div style={{ color: '#c9d1d9' }}>{p.acquired.coach}</div>}
                          <div style={{ fontSize: '.65rem' }}>
                            {p.acquired.method === 'draft' && p.acquired.pick_number
                              ? `Pick #${p.acquired.pick_number}${p.acquired.draft_year ? ` (${p.acquired.draft_year})` : ''}`
                              : p.acquired.method === 'supplemental' && p.acquired.pick_number
                              ? `Supp #${p.acquired.pick_number}${p.acquired.draft_year ? ` (${p.acquired.draft_year})` : ''}`
                              : p.acquired.method === 'trade' ? 'Trade'
                              : p.acquired.method === 'ssp' ? 'SSP'
                              : p.acquired.method || '-'}
                          </div>
                        </>
                      ) : <span style={{ color: '#484f58' }}>-</span>}
                    </td>
                    <td className="text-center">
                      {p.owner_team ? (
                        <span
                          className="pm-owner"
                          style={{ background: tc?.bg, color: tc?.fg }}
                        >
                          {p.owner_team}
                        </span>
                      ) : can_pickup ? (
                        <button
                          className="pm-add"
                          onClick={() => pickup(p.id)}
                          disabled={pickingUp === p.id}
                        >
                          {pickingUp === p.id ? '...' : <><i className="bi bi-plus-lg"></i> Add</>}
                        </button>
                      ) : (
                        <span className="pm-fa">FA</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MOBILE: redesigned player pool ═══ */}
        <div className="d-lg-none" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Sticky search + filter button */}
          <div className="kl-sticky-search">
            <div style={{ position: 'relative', flex: 1 }}>
              <i className="bi bi-search kl-sticky-search-icon"></i>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`kl-sticky-search-filter${activeFilterCount > 0 ? ' has-filters' : ''}`}
              onClick={() => setFilterOpen(true)}
            >
              <i className="bi bi-sliders2"></i>
              {activeFilterCount > 0 && (
                <span className="kl-sticky-search-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', flexShrink: 0 }}>
              {posFilter && <span className="kl-chip" onClick={() => setPosFilter('')}>{posFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
              {ageFilter && <span className="kl-chip" onClick={() => setAgeFilter('')}>{ageFilter === '30+' ? '30+' : `U${ageFilter}`} <i className="bi bi-x kl-chip-remove"></i></span>}
              {statusFilter && <span className="kl-chip" onClick={() => setStatusFilter('')}>{statusFilter === 'available' ? 'Available' : 'Rostered'} <i className="bi bi-x kl-chip-remove"></i></span>}
              {teamFilter && <span className="kl-chip" onClick={() => setTeamFilter('')}>{teamFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
              {ownerFilter && <span className="kl-chip" onClick={() => setOwnerFilter('')}>{ownerFilter} <i className="bi bi-x kl-chip-remove"></i></span>}
            </div>
          )}

          {/* Sort + count row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px', borderBottom: '1px solid rgba(48,54,61,.4)' }}>
            <span style={{ fontSize: '.72rem', color: '#6e7681' }}><b style={{ color: '#8b949e' }}>{mobileSorted.length}</b> players</span>
            <select
              className="form-select form-select-sm"
              value={mobSort}
              onChange={e => setMobSort(e.target.value as MobileSortKey)}
              style={{ background: 'transparent', border: 'none', color: '#58a6ff', fontSize: '.72rem', fontWeight: 600, width: 'auto', padding: '2px 24px 2px 4px' }}
            >
              <option value="sc">SC Avg ↓</option>
              <option value="name_asc">Name A–Z</option>
              <option value="age">Youngest</option>
              <option value="rtg">Rating ↓</option>
              <option value="gp">Games ↓</option>
            </select>
          </div>

          {/* Player list — new card design */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {mobileSorted.map(p => {
              const positions = (p.position || 'MID').split('/')
              const tc = p.owner_team ? team_colours[p.owner_team] : null
              const l3Base = p.sc_avg || p.l3 || 0
              const l3Diff = (p.l3 || 0) - l3Base
              const l3Pct = l3Base ? (l3Diff / l3Base) * 100 : 0
              const trendUp = l3Pct > 5
              const trendDown = l3Pct < -5
              return (
                <div key={p.id} className="kl-player-card">
                  {p.afl_team && data.team_logos[p.afl_team] ? (
                    <img src={data.team_logos[p.afl_team]} alt="" className="kl-player-card-logo" />
                  ) : (
                    <div className="kl-player-card-logo-placeholder">
                      <i className="bi bi-shield-fill"></i>
                    </div>
                  )}
                  <div className="kl-player-card-body">
                    <div className="kl-player-card-name">
                      {p.name}
                      {p.injury_severity && <i className="bi bi-bandaid-fill" style={{ color: '#f85149', fontSize: '.65rem', marginLeft: 4 }}></i>}
                    </div>
                    <div className="kl-player-card-meta">
                      {positions.map(pos => (
                        <span key={pos} className={`pos-badge badge-${pos.toLowerCase()}`} style={{ fontSize: '.55rem', padding: '1px 5px', lineHeight: 1.3 }}>{pos}</span>
                      ))}
                      <span>{p.age}y</span>
                      <span>·</span>
                      <span>{p.games_played}gp</span>
                      {p.profile_tag && <span className={`profile-tag tag-${p.profile_css}`} style={{ fontSize: '.5rem', padding: '0 5px' }}>{p.profile_tag}</span>}
                    </div>
                  </div>
                  <div className="kl-player-card-right">
                    {p.sc_avg ? (
                      <span className="kl-player-card-sc">{Math.round(p.sc_avg)}</span>
                    ) : (
                      <span className="kl-player-card-sc kl-player-card-sc-none">—</span>
                    )}
                    {trendUp && <span className="kl-player-card-trend kl-player-card-trend-up">▲ {Math.round(l3Pct)}%</span>}
                    {trendDown && <span className="kl-player-card-trend kl-player-card-trend-down">▼ {Math.round(Math.abs(l3Pct))}%</span>}
                    {p.owner_team ? (
                      <span className="kl-player-card-owner" style={{ background: tc?.bg, color: tc?.fg }}>{p.owner_team}</span>
                    ) : can_pickup ? (
                      <button className="kl-player-card-add" onClick={e => { e.stopPropagation(); pickup(p.id) }} disabled={pickingUp === p.id}>
                        <i className="bi bi-plus"></i>
                      </button>
                    ) : (
                      <span className="kl-player-card-fa">FA</span>
                    )}
                  </div>
                </div>
              )
            })}
            {mobileSorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#484f58' }}>
                <i className="bi bi-search" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}></i>
                <p style={{ fontSize: '.82rem', margin: 0 }}>No players match your filters</p>
              </div>
            )}
          </div>
        </div>

      {/* ═══ Filter Bottom Sheet (mobile only) ═══ */}
      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <div className="kl-filter-section">
          <div className="kl-filter-label">Position</div>
          <div className="kl-filter-options">
            {['', 'DEF', 'MID', 'FWD', 'RUC'].map(v => (
              <button key={v} type="button" className={`kl-filter-pill${posFilter === v ? ' active' : ''}`} onClick={() => setPosFilter(v)}>
                {v || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Age</div>
          <div className="kl-filter-options">
            {[['', 'All'], ['21', 'U21'], ['23', 'U23'], ['25', 'U25'], ['25-30', '25-30'], ['30+', '30+']].map(([v, label]) => (
              <button key={v} type="button" className={`kl-filter-pill${ageFilter === v ? ' active' : ''}`} onClick={() => setAgeFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Status</div>
          <div className="kl-filter-options">
            {[['', 'All'], ['available', 'Available'], ['taken', 'Rostered']].map(([v, label]) => (
              <button key={v} type="button" className={`kl-filter-pill${statusFilter === v ? ' active' : ''}`} onClick={() => setStatusFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">AFL Team</div>
          <select className="form-select form-select-sm" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}>
            <option value="">All Teams</option>
            {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="kl-filter-section">
          <div className="kl-filter-label">Coach</div>
          <select className="form-select form-select-sm" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}>
            <option value="">All Coaches</option>
            {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="kl-filter-actions">
          <button type="button" className="kl-filter-btn-clear" onClick={() => { setPosFilter(''); setAgeFilter(''); setStatusFilter(''); setTeamFilter(''); setOwnerFilter('') }}>Clear All</button>
          <button type="button" className="kl-filter-btn-apply" onClick={() => setFilterOpen(false)}>Show {mobileSorted.length} Players</button>
        </div>
      </BottomSheet>
    </div>
  )
}
