import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  ReferenceArea, Tooltip, BarChart, Bar, Cell, LabelList, LineChart, Line, ComposedChart,
} from 'recharts'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { StatTile } from '../../components/ui/StatTile'
import { TeamMobSubnav } from '../../components/nav/TeamMobSubnav'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  sc_avg_prev: number | null
  career_games: number
  games_played: number
  draft_score: number | null
  rating: number | null
  potential: number | null
  keeper_value: number | null
  height_cm: number | null
  cba_pct: number | null
  injury_severity: string | null
}

interface StatsData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null }
  players: Player[]
  total_sc: number
  avg_age: number
  position_counts: Record<string, number>
}

const POS_COLOR: Record<string, string> = {
  DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950',
}
function posCode(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}
interface DraftRoiData {
  has_data: boolean
  team: { player_id: number; name: string; position: string; pick: number; value: number; expected: number; residual: number; verdict: string }[]
  curve: { pick: number; expected: number }[]
  resid_sd: number
}
const VERDICT_COLOR: Record<string, string> = { steal: '#4ec77a', fair: '#5aa0ff', bust: '#ef6b5e' }
function avg(nums: number[]): number {
  const v = nums.filter(n => n != null && !isNaN(n))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}

// ── Watchlist auto-flags (Idea #29) — derived purely from available fields ──
type FlagKey = 'sellHigh' | 'buyLow' | 'breakout' | 'decline' | 'injury' | 'keep'
interface FlagDef { key: FlagKey; label: string; icon: string; color: string; test: (p: Player) => boolean; reason: (p: Player) => string }
const FLAGS: FlagDef[] = [
  { key: 'keep', label: 'Keep locks', icon: 'bi-shield-fill-check', color: '#a98bff',
    test: p => (p.keeper_value ?? 0) >= 80,
    reason: p => `Keeper Value ${Math.round(p.keeper_value!)}` },
  { key: 'breakout', label: 'Breakout watch', icon: 'bi-rocket-takeoff-fill', color: '#3fc4c4',
    test: p => (p.age ?? 99) <= 23 && p.potential != null && p.rating != null && (p.potential - p.rating) >= 6,
    reason: p => `Age ${p.age}, +${p.potential! - p.rating!} rating runway` },
  { key: 'sellHigh', label: 'Sell-high', icon: 'bi-graph-up-arrow', color: '#4ec77a',
    test: p => p.sc_avg_prev != null && p.sc_avg - p.sc_avg_prev >= 12,
    reason: p => `+${(p.sc_avg - p.sc_avg_prev!).toFixed(0)} SC vs last year` },
  { key: 'buyLow', label: 'Buy-low', icon: 'bi-graph-down-arrow', color: '#5aa0ff',
    test: p => p.sc_avg_prev != null && p.sc_avg - p.sc_avg_prev <= -12,
    reason: p => `${(p.sc_avg - p.sc_avg_prev!).toFixed(0)} SC vs last year` },
  { key: 'decline', label: 'Decline risk', icon: 'bi-hourglass-bottom', color: '#e0a93f',
    test: p => (p.age ?? 0) >= 30 && p.sc_avg >= 90,
    reason: p => `Age ${p.age}, ${p.sc_avg.toFixed(0)} SC — sell before the cliff` },
  { key: 'injury', label: 'Injured', icon: 'bi-bandaid-fill', color: '#ef6b5e',
    test: p => p.injury_severity === 'short' || p.injury_severity === 'long',
    reason: () => 'Currently injured' },
]

type SortField = 'rating' | 'potential' | 'runway' | 'keeper_value' | 'cba_pct' | 'sc_avg' | 'scDelta' | 'age' | 'career_games' | 'draft_score'

export function TeamStatsPage() {
  const { leagueId, teamId } = useParams()
  const { data, loading } = useFetch<StatsData>(`/leagues/${leagueId}/team/${teamId}/stats?format=json`)
  const { data: roi } = useFetch<DraftRoiData>(`/leagues/${leagueId}/team/${teamId}/draft-roi?format=json`)
  const [sortField, setSortField] = useState<SortField>('sc_avg')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeFlag, setActiveFlag] = useState<FlagKey | null>(null)
  const [usagePlayer, setUsagePlayer] = useState<Player | null>(null)
  const [compareSet, setCompareSet] = useState<number[]>([])
  const [showCompare, setShowCompare] = useState(false)
  function toggleCompare(id: number) {
    setCompareSet(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 4 ? s : [...s, id])
  }

  const flagMap = useMemo(() => {
    const m = new Map<number, FlagDef[]>()
    if (!data) return m
    for (const p of data.players) {
      const hits = FLAGS.filter(f => f.test(p))
      if (hits.length) m.set(p.id, hits)
    }
    return m
  }, [data])

  if (loading) return <Spinner text="Loading stats..." />
  if (!data) return <p className="text-danger">Failed to load team stats</p>

  const { league, team, players, total_sc, avg_age } = data
  const avgSc = avg(players.map(p => p.sc_avg))
  const avgRating = avg(players.map(p => p.rating ?? NaN))
  const avgKV = avg(players.map(p => p.keeper_value ?? NaN))

  // Flag tallies for the watchlist shelf
  const flagCounts = FLAGS.map(f => ({ ...f, players: players.filter(p => f.test(p)) }))
    .filter(f => f.players.length > 0)

  // Development-curve scatter points
  const scatter = players
    .filter(p => p.age != null && p.sc_avg > 0)
    .map(p => ({ x: p.age!, y: p.sc_avg, z: Math.max(p.career_games || 1, 1), pos: posCode(p.position), name: p.name }))

  // Age pyramid buckets
  const AGE_BUCKETS = [
    { label: '≤21', min: 0, max: 21 }, { label: '22–24', min: 22, max: 24 },
    { label: '25–27', min: 25, max: 27 }, { label: '28–30', min: 28, max: 30 },
    { label: '31+', min: 31, max: 999 },
  ]
  const pyramid = AGE_BUCKETS.map(b => {
    const inBucket = players.filter(p => p.age != null && p.age >= b.min && p.age <= b.max)
    const scMass = inBucket.reduce((s, p) => s + (p.sc_avg || 0), 0)
    const scShare = total_sc > 0 ? Math.round((scMass / total_sc) * 100) : 0
    return { bucket: b.label, count: inBucket.length, scShare, scShareLabel: `${scShare}%` }
  })

  // Sorted, optionally flag-filtered player rows
  const sortVal = (p: Player, f: SortField): number => {
    switch (f) {
      case 'runway': return (p.potential ?? 0) - (p.rating ?? 0)
      case 'scDelta': return p.sc_avg_prev != null ? p.sc_avg - p.sc_avg_prev : -999
      default: return (p as unknown as Record<string, number | null>)[f] ?? -Infinity as number
    }
  }
  const visible = players.filter(p => !activeFlag || flagMap.get(p.id)?.some(f => f.key === activeFlag))
  const sorted = [...visible].sort((a, b) => {
    const d = (sortVal(b, sortField) as number) - (sortVal(a, sortField) as number)
    return sortDir === 'desc' ? d : -d
  })
  function sortBy(f: SortField) {
    if (f === sortField) { setSortDir(d => (d === 'desc' ? 'asc' : 'desc')) }
    else { setSortField(f); setSortDir('desc') }   // first click → highest first
  }
  const sortIcon = (f: SortField) => f !== sortField ? '' : sortDir === 'desc' ? ' ▾' : ' ▴'

  const kvColor = (kv: number | null) => kv == null ? '#484f58'
    : kv >= 80 ? '#a98bff' : kv >= 65 ? '#4ec77a' : kv >= 50 ? '#5aa0ff' : '#8b949e'

  return (
    <div>
      <TeamMobSubnav active="stats" leagueId={leagueId!} teamId={teamId!} />
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/team/${teamId}`}>{team.name}</Link>
          {' / '}Stats
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <h2>{team.name} — Stats</h2>
          <div className="d-flex gap-2 d-none d-lg-flex">
            <Link to={`/leagues/${leagueId}/team/${teamId}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-people me-1"></i>Squad
            </Link>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2"><StatTile label="Squad Size" value={players.length} accent="sapphire" /></div>
        <div className="col-6 col-md-2"><StatTile label="Avg Rating" value={avgRating} accent="amethyst" decimals={1} /></div>
        <div className="col-6 col-md-2"><StatTile label="Avg Keeper Val" value={avgKV} accent="teal" decimals={0} /></div>
        <div className="col-6 col-md-2"><StatTile label="Total SC" value={total_sc} accent="forest" /></div>
        <div className="col-6 col-md-2"><StatTile label="Avg SC" value={avgSc} accent="ochre" decimals={1} /></div>
        <div className="col-6 col-md-2"><StatTile label="Avg Age" value={avg_age} accent="rust" decimals={1} /></div>
      </div>

      {/* Watchlist auto-flags shelf */}
      {flagCounts.length > 0 && (
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-binoculars-fill me-2" style={{ color: '#d29922' }}></i>Watchlist
            </h5>
            {activeFlag && (
              <button className="btn btn-sm btn-outline-secondary py-0" style={{ fontSize: '.72rem' }}
                onClick={() => setActiveFlag(null)}>Clear filter</button>
            )}
          </div>
          <div className="card-body d-flex flex-wrap gap-2">
            {flagCounts.map(f => (
              <button key={f.key}
                onClick={() => setActiveFlag(activeFlag === f.key ? null : f.key)}
                className="stats-flag-chip"
                style={{
                  ['--fc' as string]: f.color,
                  borderColor: activeFlag === f.key ? f.color : 'rgba(110,130,180,.25)',
                  background: activeFlag === f.key ? `${f.color}22` : 'rgba(110,130,180,.07)',
                } as React.CSSProperties}>
                <i className={`bi ${f.icon}`} style={{ color: f.color }}></i>
                <span className="stats-flag-label">{f.label}</span>
                <span className="stats-flag-count" style={{ background: f.color }}>{f.players.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Development curve + Age pyramid */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-graph-up me-2" style={{ color: '#8b949e' }}></i>Development Curve
                <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>age vs SC · peak window shaded</span>
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 12, bottom: 18, left: -8 }}>
                  <ReferenceArea x1={24} x2={28} fill="#3fb950" fillOpacity={0.07} />
                  <XAxis type="number" dataKey="x" name="Age" domain={[17, 'dataMax + 1']}
                    tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                    label={{ value: 'Age', position: 'insideBottom', offset: -8, fill: '#6e7681', fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="SC Avg" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <ZAxis type="number" dataKey="z" range={[40, 320]} name="Career games" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTip />} />
                  {['DEF', 'MID', 'FWD', 'RUC'].map(pos => (
                    <Scatter key={pos} name={pos} data={scatter.filter(d => d.pos === pos)} fill={POS_COLOR[pos]} fillOpacity={0.78} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="d-flex gap-3 justify-content-center mt-1" style={{ fontSize: '.72rem' }}>
                {Object.entries(POS_COLOR).map(([pos, c]) => (
                  <span key={pos}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 4 }}></span>{pos}</span>
                ))}
                <span className="text-secondary">• bubble = career games</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-bar-chart-steps me-2" style={{ color: '#8b949e' }}></i>Age Profile
                <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>% of squad SC by age</span>
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pyramid} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 6 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="bucket" tick={{ fill: '#c9d1d9', fontSize: 12 }} stroke="#30363d" width={48} />
                  <Tooltip content={<PyramidTip />} cursor={{ fill: 'rgba(110,130,180,.08)' }} />
                  <Bar dataKey="scShare" radius={[0, 5, 5, 0]}>
                    <LabelList dataKey="scShareLabel" position="right" fill="#8b949e" fontSize={11} />
                    {pyramid.map((b, i) => {
                      const c = b.bucket === '≤21' || b.bucket === '22–24' ? '#3fb950'
                        : b.bucket === '25–27' ? '#58a6ff' : b.bucket === '28–30' ? '#d29922' : '#f85149'
                      return <Cell key={i} fill={c} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Draft-value ROI */}
      {roi?.has_data && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-bullseye me-2" style={{ color: '#8b949e' }}></i>Draft Value ROI
              <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>where you picked vs what they return · dashed = expected</span>
            </h5>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart margin={{ top: 10, right: 16, bottom: 18, left: -8 }}>
                <XAxis dataKey="pick" type="number" domain={[1, 'dataMax']} allowDuplicatedCategory={false}
                  tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                  label={{ value: 'Draft pick', position: 'insideBottom', offset: -8, fill: '#6e7681', fontSize: 11 }} />
                <YAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                  label={{ value: 'SC avg', angle: -90, position: 'insideLeft', offset: 16, fill: '#6e7681', fontSize: 11 }} />
                <Tooltip content={<RoiTip />} cursor={{ strokeDasharray: '3 3' }} />
                <Line data={roi.curve} dataKey="expected" type="monotone" stroke="#6e7681" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Scatter data={roi.team} dataKey="value" isAnimationActive={false}>
                  {roi.team.map((d, i) => <Cell key={i} fill={VERDICT_COLOR[d.verdict] || '#5aa0ff'} />)}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="d-flex gap-3 justify-content-center mt-1" style={{ fontSize: '.72rem' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#4ec77a', marginRight: 4 }}></span>Steal</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#5aa0ff', marginRight: 4 }}></span>Fair</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#ef6b5e', marginRight: 4 }}></span>Bust</span>
            </div>
          </div>
        </div>
      )}

      {/* All players — rich sortable table */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-list-ul me-2" style={{ color: '#8b949e' }}></i>
            {activeFlag ? FLAGS.find(f => f.key === activeFlag)?.label : 'All Players'}
            <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.78rem' }}>{sorted.length}</span>
          </h5>
        </div>

        {/* Mobile cards */}
        <div className="d-lg-none squad-cards-mobile">
          {sorted.map(p => {
            const primary = posCode(p.position)
            const scColor = p.sc_avg >= 90 ? '#3fb950' : p.sc_avg >= 70 ? '#58a6ff' : '#8b949e'
            const hits = flagMap.get(p.id) || []
            return (
              <span key={p.id} className="squad-mob-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setUsagePlayer(p)}>
                <input type="checkbox" className="stats-cmp-check" checked={compareSet.includes(p.id)}
                  disabled={!compareSet.includes(p.id) && compareSet.length >= 4}
                  onClick={e => e.stopPropagation()} onChange={() => toggleCompare(p.id)} title="Add to compare" />
                <span className={`pos-badge pos-${primary}`} style={{ minWidth: 32, textAlign: 'center', fontSize: '.65rem' }}>{primary}</span>
                <div className="squad-mob-info">
                  <div className="squad-mob-name">
                    {p.name}
                    {hits.map(f => <i key={f.key} className={`bi ${f.icon} ms-1`} style={{ fontSize: '.62rem', color: f.color }} title={f.label}></i>)}
                  </div>
                  <div className="squad-mob-meta">
                    <span>Age {p.age || '?'}</span>
                    {p.rating != null && <span>Rtg {p.rating}</span>}
                    {p.keeper_value != null && <span style={{ color: kvColor(p.keeper_value) }}>KV {Math.round(p.keeper_value)}</span>}
                  </div>
                </div>
                <div className="squad-mob-sc" style={{ color: scColor }}>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</div>
              </span>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="card-body p-0 d-none d-lg-block" style={{ overflowX: 'auto' }}>
          <table className="table table-hover table-sm mb-0 stats-rich-table">
            <thead>
              <tr>
                <th style={{ width: 26 }} title="Add to compare"></th>
                <th>Player</th>
                <th>Pos</th>
                <th className="text-center sortable" onClick={() => sortBy('age')}>Age{sortIcon('age')}</th>
                <th className="text-end sortable" onClick={() => sortBy('rating')}>Rating{sortIcon('rating')}</th>
                <th className="text-end sortable" onClick={() => sortBy('potential')}>Pot{sortIcon('potential')}</th>
                <th className="text-end sortable" onClick={() => sortBy('runway')}>Runway{sortIcon('runway')}</th>
                <th className="text-end sortable" onClick={() => sortBy('keeper_value')}>Keeper{sortIcon('keeper_value')}</th>
                <th className="text-end sortable" onClick={() => sortBy('sc_avg')}>SC Avg{sortIcon('sc_avg')}</th>
                <th className="text-end sortable" onClick={() => sortBy('scDelta')}>Δ yr{sortIcon('scDelta')}</th>
                <th className="text-end sortable" onClick={() => sortBy('cba_pct')} title="Centre Bounce Attendance % — midfield role">CBA%{sortIcon('cba_pct')}</th>
                <th className="text-center sortable" onClick={() => sortBy('career_games')}>Games{sortIcon('career_games')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const runway = (p.potential ?? 0) - (p.rating ?? 0)
                const delta = p.sc_avg_prev != null ? p.sc_avg - p.sc_avg_prev : null
                const hits = flagMap.get(p.id) || []
                const inCompare = compareSet.includes(p.id)
                return (
                  <tr key={p.id} className={inCompare ? 'stats-row-compare' : ''}>
                    <td className="text-center" style={{ padding: 0 }}>
                      <input type="checkbox" className="stats-cmp-check" checked={inCompare}
                        disabled={!inCompare && compareSet.length >= 4}
                        onChange={() => toggleCompare(p.id)} title="Add to compare" />
                    </td>
                    <td>
                      <span className="stats-player-link" style={{ color: '#c9d1d9' }} onClick={() => setUsagePlayer(p)} title="View your usage of this player">{p.name}</span>
                      {hits.map(f => <i key={f.key} className={`bi ${f.icon} ms-1`} style={{ fontSize: '.66rem', color: f.color }} title={`${f.label} — ${f.reason(p)}`}></i>)}
                    </td>
                    <td>{(p.position || 'MID').split('/').map(pos => <span key={pos} className={`pos-badge pos-${pos}`}>{pos}</span>)}</td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{p.age || '-'}</td>
                    <td className="text-end">{p.rating ?? '-'}</td>
                    <td className="text-end" style={{ color: '#8b949e' }}>{p.potential ?? '-'}</td>
                    <td className="text-end">{p.potential != null && p.rating != null
                      ? <span style={{ color: runway > 0 ? '#4ec77a' : '#6e7681' }}>{runway > 0 ? `+${runway}` : runway}</span> : '-'}</td>
                    <td className="text-end fw-bold" style={{ color: kvColor(p.keeper_value) }}>{p.keeper_value != null ? Math.round(p.keeper_value) : '-'}</td>
                    <td className="text-end fw-bold">{p.sc_avg ? p.sc_avg.toFixed(1) : '-'}</td>
                    <td className="text-end">{delta == null ? '-'
                      : <span style={{ color: delta >= 0 ? '#4ec77a' : '#ef6b5e' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}</span>}</td>
                    <td className="text-end">{p.cba_pct == null ? '-'
                      : <span style={{ color: p.cba_pct >= 60 ? '#bc8cff' : p.cba_pct >= 25 ? '#8b949e' : '#484f58' }}>{Math.round(p.cba_pct)}</span>}</td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{p.career_games || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {usagePlayer && (
        <PlayerUsageModal player={usagePlayer} leagueId={leagueId!} teamId={teamId!}
          teamName={team.name} onClose={() => setUsagePlayer(null)} />
      )}

      {compareSet.length > 0 && (
        <div className="cmp-tray">
          <div className="cmp-tray-chips">
            <span className="cmp-tray-label"><i className="bi bi-layout-split me-1"></i>Compare</span>
            {compareSet.map(id => {
              const pl = players.find(p => p.id === id)
              return (
                <span key={id} className="cmp-tray-chip">
                  {pl?.name ?? id}
                  <i className="bi bi-x-lg" onClick={() => toggleCompare(id)}></i>
                </span>
              )
            })}
          </div>
          <div className="cmp-tray-actions">
            <button className="cmp-tray-clear" onClick={() => setCompareSet([])}>Clear</button>
            <button className="cmp-tray-go" disabled={compareSet.length < 2} onClick={() => setShowCompare(true)}>
              Compare {compareSet.length}
            </button>
          </div>
        </div>
      )}
      {showCompare && (
        <CompareModal leagueId={leagueId!} teamId={teamId!} ids={compareSet} onClose={() => setShowCompare(false)} />
      )}
    </div>
  )
}

// ── Side-by-side compare (#30) ──
interface ComparePlayer {
  player_id: number; name: string; position: string; afl_team: string; age: number | null
  sc_avg: number | null; rating: number | null; potential: number | null; keeper_value: number | null
  cba_pct: number | null
  ceiling: number | null; floor: number | null; consistency: number | null; next_season: number | null
  points_banked: number | null; team_games: number | null; captain_games: number | null
  season_trend: { year: number; avg: number }[]
}
const CMP_PALETTE = ['#58a6ff', '#4ec77a', '#e0a93f', '#bc8cff']
const CMP_ROWS: { k: keyof ComparePlayer; label: string; hb: boolean }[] = [
  { k: 'sc_avg', label: 'SuperCoach avg', hb: true },
  { k: 'rating', label: 'Rating', hb: true },
  { k: 'potential', label: 'Potential', hb: true },
  { k: 'keeper_value', label: 'Keeper Value', hb: true },
  { k: 'cba_pct', label: 'CBA% (mid role)', hb: true },
  { k: 'age', label: 'Age', hb: false },
  { k: 'ceiling', label: 'Ceiling', hb: true },
  { k: 'floor', label: 'Floor', hb: true },
  { k: 'consistency', label: 'Consistency', hb: true },
  { k: 'next_season', label: 'Proj. next season', hb: true },
  { k: 'points_banked', label: 'Banked for you', hb: true },
  { k: 'team_games', label: 'Games for you', hb: true },
]

function CompareModal({ leagueId, teamId, ids, onClose }: {
  leagueId: string; teamId: string; ids: number[]; onClose: () => void
}) {
  const { data, loading } = useFetch<{ players: ComparePlayer[] }>(
    `/leagues/${leagueId}/team/${teamId}/compare?ids=${ids.join(',')}&format=json`)
  const players = data?.players ?? []

  const bestIdx = (row: typeof CMP_ROWS[number]): number => {
    let bi = -1, bv: number | null = null
    players.forEach((p, i) => {
      const v = p[row.k] as number | null
      if (v == null) return
      if (bv == null || (row.hb ? v > bv : v < bv)) { bv = v; bi = i }
    })
    return bi
  }

  // Merge season trends into one dataset for the overlaid chart
  const years = Array.from(new Set(players.flatMap(p => p.season_trend.map(s => s.year)))).sort()
  const chartData = years.map(y => {
    const row: Record<string, number> = { year: y }
    players.forEach(p => { const t = p.season_trend.find(s => s.year === y); if (t) row[p.name] = t.avg })
    return row
  })

  return (
    <div className="usage-overlay" onClick={onClose}>
      <div className="usage-modal cmp-modal" onClick={e => e.stopPropagation()}>
        <div className="usage-head">
          <div className="usage-name">Compare players</div>
          <button className="usage-close" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg"></i></button>
        </div>
        {loading || !data ? (
          <div className="usage-body"><div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading comparison…</div></div>
        ) : (
          <div className="usage-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th></th>
                    {players.map((p, i) => (
                      <th key={p.player_id}>
                        <span className="cmp-dot" style={{ background: CMP_PALETTE[i] }}></span>
                        <div className="cmp-name">{p.name}</div>
                        <div className="cmp-meta">{posCode(p.position)} · {p.afl_team}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CMP_ROWS.map(row => {
                    const best = bestIdx(row)
                    return (
                      <tr key={row.k as string}>
                        <td className="cmp-row-label">{row.label}</td>
                        {players.map((p, i) => {
                          const v = p[row.k] as number | null
                          return <td key={p.player_id} className={`cmp-cell${i === best && players.length > 1 ? ' cmp-best' : ''}`}>{v == null ? '–' : v}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {chartData.length > 1 && (
              <div className="usage-timeline-wrap">
                <div className="usage-section-title">Career arc — SC average by season</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
                    <XAxis dataKey="year" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                    <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                    <Tooltip cursor={{ stroke: '#30363d' }}
                      contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                    {players.map((p, i) => (
                      <Line key={p.player_id} type="monotone" dataKey={p.name} stroke={CMP_PALETTE[i]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Per-player usage drill-down (ideas #31–38): how this team deployed a player ──
interface UsageData {
  team_games: number; bench_rounds: number; out_rounds: number; rounds_rostered: number
  captain_games: number; vc_games: number; captain_points: number
  emg_named: number; emg_activated: number; emg_points: number
  points_banked: number; contribution_pct: number; team_total: number
  sevens_games: number; sevens_captain: number; sevens_points: number
  acquired_via: string | null
  timeline: { round: number; role: string; score: number | null; captain: boolean; vc: boolean }[]
}
const ROLE_META: Record<string, { c: string; label: string }> = {
  field: { c: '#4ec77a', label: 'On field' },
  bench: { c: '#6e7681', label: 'Benched' },
  emg: { c: '#e0a93f', label: 'Emergency (named)' },
  emg_in: { c: '#a98bff', label: 'Emergency (subbed in)' },
  out: { c: '#30363d', label: 'Out / not selected' },
}

interface ScoringData {
  has_data: boolean; games: number; mean: number; median: number
  ceiling: number; floor: number; stdev: number; consistency: number
  boom: number; bust: number; boom_pct: number; bust_pct: number
  last5: number[]; hist: { bucket: string; count: number }[]
}
function consistencyLabel(c: number): string {
  return c >= 80 ? 'Metronomic' : c >= 65 ? 'Reliable' : c >= 45 ? 'Streaky' : 'Volatile'
}
const HIST_COLOR: Record<string, string> = {
  '<60': '#ef6b5e', '60–79': '#d2884f', '80–99': '#5aa0ff', '100–119': '#4ec77a', '120+': '#a98bff',
}
interface BenchmarkData {
  has_data: boolean; position: string; cohort: number
  metrics: { key: string; label: string; value: number; percentile: number; of: number }[]
}
interface ProjectionData {
  has_data: boolean
  next_round: number
  next_round_inputs: { last3: number; season: number; career: number }
  next_season: number; next_season_low: number; next_season_high: number
  age_delta_pct: number; next_age: number | null
  season_trend: { year: number; avg: number }[]
}

function PlayerUsageModal({ player, leagueId, teamId, teamName, onClose }: {
  player: Player; leagueId: string; teamId: string; teamName: string; onClose: () => void
}) {
  const [tab, setTab] = useState<'usage' | 'scoring' | 'projection' | 'benchmarks'>('usage')
  const base = `/leagues/${leagueId}/team/${teamId}/player/${player.id}`
  const { data: u, loading } = useFetch<UsageData>(`${base}/usage?format=json`)
  const { data: sc, loading: scLoading } = useFetch<ScoringData>(
    tab === 'scoring' ? `${base}/scoring?format=json` : null)
  const { data: pj, loading: pjLoading } = useFetch<ProjectionData>(
    tab === 'projection' ? `${base}/projection?format=json` : null)
  const { data: bm, loading: bmLoading } = useFetch<BenchmarkData>(
    tab === 'benchmarks' ? `${base}/benchmarks?format=json` : null)
  const primary = posCode(player.position)
  const rolesPresent = u ? Array.from(new Set(u.timeline.map(t => t.role))) : []

  return (
    <div className="usage-overlay" onClick={onClose}>
      <div className="usage-modal" onClick={e => e.stopPropagation()}>
        <div className="usage-head">
          <div>
            <div className="usage-name">{player.name}</div>
            <div className="usage-sub">
              <span className={`pos-badge pos-${primary}`}>{player.position}</span>
              <span>{player.afl_team}</span>{player.age ? <span>Age {player.age}</span> : null}
              <span className="usage-context">in {teamName}</span>
            </div>
          </div>
          <button className="usage-close" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="usage-tabs">
          <button className={`usage-tab${tab === 'usage' ? ' active' : ''}`} onClick={() => setTab('usage')}>Your usage</button>
          <button className={`usage-tab${tab === 'scoring' ? ' active' : ''}`} onClick={() => setTab('scoring')}>Scoring profile</button>
          <button className={`usage-tab${tab === 'projection' ? ' active' : ''}`} onClick={() => setTab('projection')}>Projection</button>
          <button className={`usage-tab${tab === 'benchmarks' ? ' active' : ''}`} onClick={() => setTab('benchmarks')}>Benchmarks</button>
        </div>

        {tab === 'benchmarks' ? (
          <div className="usage-body">
            {bmLoading || !bm ? (
              <div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading benchmarks…</div>
            ) : !bm.has_data ? (
              <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>Not enough cohort data to benchmark.</div>
            ) : (
              <>
                <div className="usage-section-title">vs other {bm.position}s <span style={{ color: '#6e7681', fontWeight: 400 }}>· {bm.cohort} in pool · percentile</span></div>
                {bm.metrics.map(m => {
                  const c = m.percentile >= 80 ? '#4ec77a' : m.percentile >= 55 ? '#5aa0ff' : m.percentile >= 30 ? '#d2884f' : '#ef6b5e'
                  return (
                    <div key={m.key} className="bm-row">
                      <div className="bm-label">{m.label}</div>
                      <div className="bm-track"><div className="bm-fill" style={{ width: `${m.percentile}%`, background: c }}></div></div>
                      <div className="bm-val">{m.value}</div>
                      <div className="bm-pct" style={{ color: c }}>{m.percentile}<span className="bm-pct-th">{m.percentile % 10 === 1 && m.percentile !== 11 ? 'st' : m.percentile % 10 === 2 && m.percentile !== 12 ? 'nd' : m.percentile % 10 === 3 && m.percentile !== 13 ? 'rd' : 'th'}</span></div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        ) : tab === 'projection' ? (
          <div className="usage-body">
            {pjLoading || !pj ? (
              <div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading projection…</div>
            ) : !pj.has_data ? (
              <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>Not enough scoring history to project.</div>
            ) : (
              <>
                <div className="proj-cards">
                  <div className="proj-card" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}>
                    <div className="proj-card-lbl">Next round</div>
                    <div className="proj-card-val">~{pj.next_round}</div>
                    <div className="proj-card-sub">form-weighted · L3 {pj.next_round_inputs.last3} · Szn {pj.next_round_inputs.season} · Career {pj.next_round_inputs.career}</div>
                  </div>
                  <div className="proj-card" style={{ ['--uc' as string]: '#a98bff' } as React.CSSProperties}>
                    <div className="proj-card-lbl">Next season</div>
                    <div className="proj-card-val">~{pj.next_season} <span className="proj-band">{pj.next_season_low}–{pj.next_season_high}</span></div>
                    <div className="proj-card-sub">
                      {pj.next_age ? `age ${pj.next_age} → ` : ''}
                      <span style={{ color: pj.age_delta_pct > 0 ? '#4ec77a' : pj.age_delta_pct < 0 ? '#ef6b5e' : '#8b949e' }}>
                        {pj.age_delta_pct > 0 ? '+' : ''}{pj.age_delta_pct}% age curve
                      </span>
                    </div>
                  </div>
                </div>
                {pj.season_trend.length > 1 && (
                  <div className="usage-timeline-wrap">
                    <div className="usage-section-title">Season SC average — career arc</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={pj.season_trend} margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
                        <XAxis dataKey="year" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                        <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                        <Tooltip cursor={{ stroke: '#30363d' }}
                          contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                        <Line type="monotone" dataKey="avg" stroke="#58a6ff" strokeWidth={2} dot={{ r: 3, fill: '#58a6ff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="text-secondary" style={{ fontSize: '.72rem', marginTop: 6 }}>
                  Estimates from SuperCoach history + a position-agnostic age curve. Not financial advice. 😉
                </div>
              </>
            )}
          </div>
        ) : tab === 'scoring' ? (
          <div className="usage-body">
            {scLoading || !sc ? (
              <div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading scoring…</div>
            ) : !sc.has_data ? (
              <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>No SuperCoach game history on record.</div>
            ) : (
              <>
                <div className="usage-tiles">
                  <div className="usage-tile" style={{ ['--uc' as string]: '#a98bff' } as React.CSSProperties}>
                    <div className="usage-tile-val">{Math.round(sc.ceiling)}</div>
                    <div className="usage-tile-lbl">Ceiling</div>
                    <div className="usage-tile-sub">90th-pct game</div>
                  </div>
                  <div className="usage-tile" style={{ ['--uc' as string]: '#ef6b5e' } as React.CSSProperties}>
                    <div className="usage-tile-val">{Math.round(sc.floor)}</div>
                    <div className="usage-tile-lbl">Floor</div>
                    <div className="usage-tile-sub">10th-pct game</div>
                  </div>
                  <div className="usage-tile" style={{ ['--uc' as string]: '#4ec77a' } as React.CSSProperties}>
                    <div className="usage-tile-val">{sc.consistency}</div>
                    <div className="usage-tile-lbl">Consistency</div>
                    <div className="usage-tile-sub">{consistencyLabel(sc.consistency)}</div>
                  </div>
                  <div className="usage-tile" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}>
                    <div className="usage-tile-val">{sc.boom_pct}<span className="usage-tile-unit">%</span></div>
                    <div className="usage-tile-lbl">Boom rate</div>
                    <div className="usage-tile-sub">{sc.boom} games 120+</div>
                  </div>
                  <div className="usage-tile" style={{ ['--uc' as string]: '#d2884f' } as React.CSSProperties}>
                    <div className="usage-tile-val">{sc.bust_pct}<span className="usage-tile-unit">%</span></div>
                    <div className="usage-tile-lbl">Bust rate</div>
                    <div className="usage-tile-sub">{sc.bust} games ≤60</div>
                  </div>
                </div>

                {/* Ceiling–floor range bar */}
                <div className="usage-timeline-wrap">
                  <div className="usage-section-title">Scoring range <span style={{ color: '#6e7681', fontWeight: 400 }}>· {sc.games} games · median {Math.round(sc.median)}</span></div>
                  <div className="scoring-range">
                    <div className="scoring-range-fill" style={{ left: `${sc.floor / 150 * 100}%`, width: `${Math.max(2, (sc.ceiling - sc.floor) / 150 * 100)}%` }}></div>
                    <div className="scoring-range-tick" style={{ left: `${sc.median / 150 * 100}%` }} title={`Median ${Math.round(sc.median)}`}></div>
                  </div>
                  <div className="scoring-range-axis"><span>0</span><span>50</span><span>100</span><span>150</span></div>
                  {sc.last5.length > 0 && (
                    <div className="scoring-last5">
                      <span className="usage-section-title" style={{ margin: 0 }}>Last 5</span>
                      {sc.last5.map((v, i) => (
                        <span key={i} className="scoring-last5-chip" style={{ background: v >= 120 ? '#a98bff' : v >= 100 ? '#4ec77a' : v >= 80 ? '#5aa0ff' : v >= 60 ? '#d2884f' : '#ef6b5e' }}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Distribution histogram */}
                <div className="usage-timeline-wrap">
                  <div className="usage-section-title">Score distribution</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={sc.hist} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                      <XAxis dataKey="bucket" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                      <YAxis allowDecimals={false} tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                      <Tooltip cursor={{ fill: 'rgba(110,130,180,.08)' }}
                        contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {sc.hist.map((h, i) => <Cell key={i} fill={HIST_COLOR[h.bucket] || '#5aa0ff'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        ) : loading || !u ? (
          <div className="usage-body"><div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading usage…</div></div>
        ) : (
          <div className="usage-body">
            <div className="usage-tiles">
              <div className="usage-tile" style={{ ['--uc' as string]: '#4ec77a' } as React.CSSProperties}>
                <div className="usage-tile-val">{u.team_games}</div>
                <div className="usage-tile-lbl">Games for you</div>
                <div className="usage-tile-sub">{u.bench_rounds} benched · {u.out_rounds} out</div>
              </div>
              <div className="usage-tile" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}>
                <div className="usage-tile-val">{Math.round(u.points_banked)}</div>
                <div className="usage-tile-lbl">Points banked</div>
                <div className="usage-tile-sub">{u.contribution_pct}% of your total</div>
              </div>
              <div className="usage-tile" style={{ ['--uc' as string]: '#e0a93f' } as React.CSSProperties}>
                <div className="usage-tile-val">{u.captain_games}<span className="usage-tile-unit">×C</span></div>
                <div className="usage-tile-lbl">Captained</div>
                <div className="usage-tile-sub">{u.captain_games > 0 ? `+${Math.round(u.captain_points)} bonus` : `${u.vc_games}× VC`}</div>
              </div>
              {u.sevens_games > 0 && (
                <div className="usage-tile" style={{ ['--uc' as string]: '#bc8cff' } as React.CSSProperties}>
                  <div className="usage-tile-val">{u.sevens_games}</div>
                  <div className="usage-tile-lbl">7s games</div>
                  <div className="usage-tile-sub">{u.sevens_captain}× C · {Math.round(u.sevens_points)} pts</div>
                </div>
              )}
              {u.emg_named > 0 && (
                <div className="usage-tile" style={{ ['--uc' as string]: '#ef6b5e' } as React.CSSProperties}>
                  <div className="usage-tile-val">{u.emg_activated}<span className="usage-tile-unit">/{u.emg_named}</span></div>
                  <div className="usage-tile-lbl">Emergency in</div>
                  <div className="usage-tile-sub">+{Math.round(u.emg_points)} pts salvaged</div>
                </div>
              )}
            </div>

            {u.timeline.length > 0 && (
              <div className="usage-timeline-wrap">
                <div className="usage-section-title">Season usage — round by round</div>
                <div className="usage-ribbon">
                  {u.timeline.map(t => {
                    const meta = ROLE_META[t.role] || ROLE_META.out
                    return (
                      <div key={t.round} className="usage-cell" title={`R${t.round} · ${meta.label}${t.score != null ? ` · ${t.score}` : ''}${t.captain ? ' · (C)' : ''}`}>
                        <div className="usage-cell-round">R{t.round}</div>
                        <div className="usage-cell-box" style={{ background: meta.c, opacity: t.role === 'out' ? 0.5 : 1 }}>
                          {t.score != null ? Math.round(t.score) : ''}
                          {t.captain && <span className="usage-cell-c">C</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="usage-legend">
                  {rolesPresent.map(r => {
                    const meta = ROLE_META[r] || ROLE_META.out
                    return <span key={r} className="usage-legend-item"><span className="usage-legend-dot" style={{ background: meta.c }}></span>{meta.label}</span>
                  })}
                </div>
              </div>
            )}
            {u.timeline.length === 0 && (
              <div className="text-secondary" style={{ padding: '12px 0' }}>No lineup history for this season yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; x: number; y: number; z: number; pos: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>{d.name}</div>
      <div style={{ color: '#8b949e' }}>{d.pos} · Age {d.x} · {d.y.toFixed(1)} SC · {d.z} gms</div>
    </div>
  )
}

function RoiTip({ active, payload }: { active?: boolean; payload?: { payload: { name?: string; pick: number; value?: number; expected: number; residual?: number; verdict?: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.name == null) return null   // hovering the expectation line, not a player
  const c = VERDICT_COLOR[d.verdict || 'fair']
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>{d.name}</div>
      <div style={{ color: '#8b949e' }}>Pick {d.pick} · {d.value} SC · exp {d.expected}</div>
      <div style={{ color: c, fontWeight: 700, textTransform: 'capitalize' }}>{d.verdict} ({(d.residual ?? 0) >= 0 ? '+' : ''}{d.residual} vs pick)</div>
    </div>
  )
}

function PyramidTip({ active, payload }: { active?: boolean; payload?: { payload: { bucket: string; count: number; scShare: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>Age {d.bucket}</div>
      <div style={{ color: '#8b949e' }}>{d.count} player{d.count === 1 ? '' : 's'} · {d.scShare}% of squad SC</div>
    </div>
  )
}
